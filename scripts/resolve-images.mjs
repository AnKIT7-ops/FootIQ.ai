// Resolves FotMob player IDs (name + expected club) and verifies portrait URLs return 200.
const T = { ars: 9825, mci: 8456, liv: 8650, che: 8455, mun: 10260, tot: 8586, new: 10261, avl: 10252, rma: 8633, bar: 8634, bay: 9823, psg: 9847 };

const players = [
  ["saka", "Bukayo Saka", T.ars], ["odegaard", "Martin Odegaard", T.ars], ["rice", "Declan Rice", T.ars],
  ["saliba", "William Saliba", T.ars], ["raya", "David Raya", T.ars], ["haaland", "Erling Haaland", T.mci],
  ["rodri", "Rodri", T.mci], ["foden", "Phil Foden", T.mci], ["salah", "Mohamed Salah", T.liv],
  ["vvd", "Virgil van Dijk", T.liv], ["wirtz", "Florian Wirtz", T.liv], ["isak", "Alexander Isak", T.liv],
  ["palmer", "Cole Palmer", T.che], ["caicedo", "Moises Caicedo", T.che], ["bruno", "Bruno Fernandes", T.mun],
  ["mainoo", "Kobbie Mainoo", T.mun], ["kudus", "Mohammed Kudus", T.tot], ["gordon", "Anthony Gordon", T.new],
  ["tonali", "Sandro Tonali", T.new], ["watkins", "Ollie Watkins", T.avl], ["mbappe", "Kylian Mbappe", T.rma],
  ["bellingham", "Jude Bellingham", T.rma], ["vinicius", "Vinicius Junior", T.rma], ["yamal", "Lamine Yamal", T.bar],
  ["pedri", "Pedri", T.bar], ["raphinha", "Raphinha", T.bar], ["kane", "Harry Kane", T.bay],
  ["musiala", "Jamal Musiala", T.bay], ["olise", "Michael Olise", T.bay], ["dembele", "Ousmane Dembele", T.psg],
  ["vitinha", "Vitinha", T.psg], ["doue", "Desire Doue", T.psg],
];

const headers = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

async function imgOk(url) {
  try {
    return (await fetch(url, { headers })).ok;
  } catch {
    return false;
  }
}

const out = {};
const bad = [];
for (const [key, name, teamId] of players) {
  try {
    const r = await fetch(`https://apigw.fotmob.com/searchapi/suggest?term=${encodeURIComponent(name)}&lang=en`, { headers });
    const j = await r.json();
    const options = (j.squadMemberSuggest ?? []).flatMap((s) => s.options ?? []);
    const cands = options.map((o) => {
      const [n, id] = String(o.text).split("|");
      return { name: n, id, teamId: o.payload?.teamId, score: o.score ?? 0 };
    });
    const last = norm(name).split(" ").pop();
    // exact club match first, then best-scoring name match
    const hit =
      cands.find((c) => c.teamId === teamId && norm(c.name).includes(last)) ??
      cands.find((c) => norm(c.name).includes(last));
    if (!hit) {
      bad.push(key);
      console.log(`${key}: NO MATCH`);
      continue;
    }
    const ok = await imgOk(`https://images.fotmob.com/image_resources/playerimages/${hit.id}.png`);
    if (!ok || hit.teamId !== teamId) bad.push(key);
    out[key] = Number(hit.id);
    console.log(`${key}: ${hit.id} — ${hit.name} (team ${hit.teamId}${hit.teamId === teamId ? " ✓" : " ✗ EXPECTED " + teamId}) image ${ok ? "OK" : "MISSING"}`);
    await new Promise((res) => setTimeout(res, 120));
  } catch (e) {
    bad.push(key);
    console.log(`${key}: ERROR ${String(e).slice(0, 100)}`);
  }
}
console.log("\nflagged:", bad.length ? bad.join(",") : "none");
console.log("\nconst fotmobPlayerIds = " + JSON.stringify(out, null, 2) + ";");
