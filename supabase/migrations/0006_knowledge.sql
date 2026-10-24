-- Knowledge base for retrieval-augmented answers (the concierge's /ask).
--
-- Source: the Guardian Open Platform (full article text under a developer
-- key). Bodies live here for retrieval only — the API never returns them; the
-- chat shows the cited title and links out. `body` is kept so retrieval evals
-- can re-chunk the pinned golden documents under different settings without
-- re-fetching. Pinned documents are the golden set and are never pruned.
-- Server-only, like ai_cache: RLS on, no policies, service role reads/writes.

create extension if not exists vector with schema extensions;

create table public.kb_documents (
  id            text primary key,              -- Guardian content id
  source        text not null,                 -- publisher name shown in citations
  url           text not null,
  title         text not null,
  byline        text,
  body          text not null,
  published_at  timestamptz not null,
  content_hash  text not null unique,          -- sha256 of the normalized body: catches re-publishes under a new id
  chunk_count   integer not null default 0,
  pinned        boolean not null default false,
  fetched_at    timestamptz not null default now()
);

create index kb_documents_published_idx on public.kb_documents (published_at desc);

create table public.kb_chunks (
  id         bigint generated always as identity primary key,
  doc_id     text not null references public.kb_documents (id) on delete cascade,
  ord        integer not null,
  text       text not null,
  embedding  extensions.vector(768) not null,  -- gemini-embedding-001, outputDimensionality 768, L2-normalized
  unique (doc_id, ord)
);

create index kb_chunks_embedding_idx on public.kb_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.kb_documents enable row level security;
alter table public.kb_chunks enable row level security;
revoke all on public.kb_documents from anon, authenticated;
revoke all on public.kb_chunks from anon, authenticated;

-- Nearest chunks by cosine similarity, with the document metadata a citation needs.
create or replace function public.match_kb_chunks(
  query_embedding extensions.vector(768),
  match_count integer default 6,
  min_similarity double precision default 0
) returns table (
  chunk_id      bigint,
  doc_id        text,
  ord           integer,
  text          text,
  similarity    double precision,
  title         text,
  url           text,
  source        text,
  published_at  timestamptz
) language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.doc_id, c.ord, c.text,
         1 - (c.embedding <=> query_embedding) as similarity,
         d.title, d.url, d.source, d.published_at
  from public.kb_chunks c
  join public.kb_documents d on d.id = c.doc_id
  where 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;
revoke execute on function public.match_kb_chunks(extensions.vector, integer, double precision) from public, anon, authenticated;
