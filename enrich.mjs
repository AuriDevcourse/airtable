// Writes researched LinkedIn + Bio onto specific Grill Session rows, matched by exact Full Name.
// Only people whose company/title was corroborated by a non-LinkedIn source are in here.
const token=process.env.AIRTABLE_TOKEN;
const BASE="appgXNjXJqpk9Ebxd", T="tblTecOBecLQCNIeD", V="viwfIcQFDNQ9ggSqx";
const h={Authorization:`Bearer ${token}`};
const COMMIT=process.argv.includes("--commit");

const FOUND=[
 { name:"Cecilia Edebo",
   linkedin:"https://www.linkedin.com/in/cecilia-edebo-28384726/",
   bio:"CEO of Sahlgrenska Science Park since 2024, where she leads the park's work on collaborative health innovation. Previously CEO of Cellink, the 3D bioprinting company in the BICO group, and held CEO, COO and VP Sales & Marketing roles at Essity across Europe, the US and Asia." },
 { name:"Johan Andersson",
   linkedin:"https://www.linkedin.com/in/misterandersson/",
   bio:"Business advisor at Brewhouse Inkubator in Gothenburg, working with early-stage startups on product, go-to-market and partnerships. NOTE: LinkedIn match is based on the Brewhouse company name only - please confirm this is the right Johan Andersson." },

 // --- 2026-08-09 batch. Corroboration source recorded per person. ---
 { name:"Guillaume Petit-Pierre",
   linkedin:"https://www.linkedin.com/in/guillaume-petit-pierre-85b87552" },   // EPFL Alumni + Venturelab
 { name:"Carl Carell",
   linkedin:"https://www.linkedin.com/in/carlcarell/" },                      // GetAccept careers site + Y Combinator
 { name:"Kasper Hulthin",
   linkedin:"https://www.linkedin.com/in/hulthin/" },                         // byFounders + TechSavvy + Vendep
 { name:"Vincent van der Holst",
   linkedin:"https://www.linkedin.com/in/vincentvanderholst/" },              // WWD + FashionUnited + Stichting DOEN
 { name:"Olgac Ergeneman",
   linkedin:"https://www.linkedin.com/in/oergeneman" },                       // Venture Kick + magnes.ch
 { name:"Frank Kjerstein",
   linkedin:"https://www.linkedin.com/in/frank-kjerstein" },                  // reblade.dk/team + Nordic Labour Journal
 { name:"Martin Keller",
   linkedin:"https://www.linkedin.com/in/martin-keller-640ab458" },           // Venturelab; headline itself reads "CEO Acodis"
 { name:"Maarten Everts",
   linkedin:"https://www.linkedin.com/in/maarteneverts" },                    // University of Twente staff page
 { name:"Kim Rants",
   linkedin:"https://www.linkedin.com/in/kimrants/" },                        // Y Combinator + EU-Startups + BeBeez
 { name:"Isabella Vahdati",
   linkedin:"https://www.linkedin.com/in/isabella-vahdati-09bb17a3" },        // brighteyevc.com/team + NFX Signal
 { name:"Pia Hardy",
   linkedin:"https://www.linkedin.com/in/pia-hardy-483254138",
   bio:"NOTE: LinkedIn match is corroborated only by the exact job-title/company match (NVIDIA Head of Healthcare & Life Sciences, Nordics) - no independent non-LinkedIn profile was found. Please confirm this is the right Pia Hardy before this bio is replaced with a real one." },

 // --- 2026-08-09 batch 2 ---
 { name:"Jussi Pyysalo",
   linkedin:"https://www.linkedin.com/in/jussi-pyysalo-6495234/" },           // businessturku.fi contact page, title matches exactly
 { name:"Dr. Ilya Burkov",
   linkedin:"https://www.linkedin.com/in/ilyaburkov/" },                      // BusinessWire press release, exact title match
 { name:"Juuso Blomster",
   linkedin:"https://www.linkedin.com/in/juuso-blomster-50b01473" },          // Tech.eu + Maki.vc + cardiosignal.com
 { name:"Louise Lachmann",
   linkedin:"https://www.linkedin.com/in/louiselachmann/" },                  // uglyduckling.ventures own site + Bird & Bird
 { name:"Michael Yngfors",
   linkedin:"https://www.linkedin.com/in/michaelyngfors/" },                  // Business Region Goteborg press release
 { name:"Laurie Lancee",
   linkedin:"https://www.linkedin.com/in/laurielancee/" },                    // EIT Europa nominee page + atventureplatform.com
 { name:"Victoria Throen Longhi",
   linkedin:"https://www.linkedin.com/in/victoriathroenlonghi" },             // owlvc.com/team own page, exact title match
 { name:"Jillian Als",
   linkedin:"https://www.linkedin.com/in/jillianals/" },                      // Dealfront/Leadfeeder own press release naming her CMO
 { name:"George Storm",
   linkedin:"https://www.linkedin.com/in/georgestormbtb" },                   // B2B Marketing European ABM Forum speaker page
 { name:"Sara Storm",
   linkedin:"https://www.linkedin.com/in/saralstorm" },                       // funnelemea.com; headline reads "SVP EMEA @ N.Rich"
 { name:"Olivia Stokholm",
   linkedin:"https://www.linkedin.com/in/oliviastokholm/" },                  // amplitude.dk/om-os own about page
 { name:"Katrine Rasmussen",
   linkedin:"https://www.linkedin.com/in/katrinerasmussen/" },                // SaaSiest author page. NB company is PIXELZ, Airtable says "Pexelz"
 { name:"Gertrude Chilufya",
   linkedin:"https://www.linkedin.com/in/gertrude-chilufya" },                // theblackwomenintech.com profile

 // Identity solid but the ROW's title/company disagrees with every source - see progress.md
 { name:"Thomas Eaton",
   linkedin:"https://www.linkedin.com/in/treaton" },                          // profile reads Limula; sources say CEO, row says CFO
 { name:"Mårten Skogh",
   linkedin:"https://www.linkedin.com/in/martenskogh/" },                     // chalmersnextlabs.se team page + Google Scholar + GitHub
 { name:"Vahid Sohrabpour",
   linkedin:"https://www.linkedin.com/in/vahidsohrabpour/" },                 // Google Scholar + Brilliant Minds pitch page

 // Distinctive name + explicit company in headline, but NO independent non-LinkedIn source found
 { name:"Rogier Brakshoofden",
   linkedin:"https://www.linkedin.com/in/rogierbrakshoofden",
   bio:"NOTE: LinkedIn match rests on the distinctive surname plus a headline naming NextNextYear - no independent non-LinkedIn source exists for this one-person venture. Please confirm." },
 { name:"Moritz Hartmann",
   linkedin:"https://www.linkedin.com/in/moritz-hartmann/",
   bio:"NOTE: LinkedIn match is corroborated only by his own profile naming Ento (Chief of Staff -> COO). Other Moritz Hartmanns exist, incl. one at Airbus. Please confirm." },
 { name:"Anna Kivinen",
   linkedin:"https://www.linkedin.com/in/annakivinen",
   bio:"NOTE: confirmed at the City of Turku via turku.fi, but public sources give her title as Project Director / Liaison Manager, not Innovation Director as this row says. Please confirm both the profile and the title." },

 // --- 2026-08-09 batch 3 ---
 { name:"Gaia Balossi",
   linkedin:"https://www.linkedin.com/in/gaia-licia-balossi/" },              // thehub.io + kapa.ai job post. Full name is Gaia Licia Balossi
 { name:"Maarten Kas",
   linkedin:"https://www.linkedin.com/in/maartenkas" },                       // EDIH Digital Hub NW article: "Maarten Kas, CEO van Remotik"
 { name:"Magnus Dadi Eyjolfsson",
   linkedin:"https://www.linkedin.com/in/magnus-dadi-eyjolfsson-533516234" }, // klak.is own team announcement, exact title match
 { name:"Olli Huhtinen",
   linkedin:"https://www.linkedin.com/in/olli-huhtinen" },                    // Abo Akademi BioBridge event + evogencebio.com
 { name:"Juuso Juhila",
   linkedin:"https://www.linkedin.com/in/juuso-juhila-87a7b735/" },           // thestra.fi own press release announcing him CEO
 { name:"Teis Nilou Nørgaard",
   linkedin:"https://www.linkedin.com/in/teis-norgaard" },                    // icdk.dk / kina.um.dk official Danish MFA site
 { name:"Richard Holborow",
   linkedin:"https://www.linkedin.com/in/richard-holborow-0a8494203/" },      // Arena International speaker page + CORE-MD podcast
 { name:"Roxana Belciu Kerns",
   linkedin:"https://www.linkedin.com/in/amarastesia/" },                     // amarastesia.com own post + Magnus Conferences. Vanity URL is the company word but it IS her personal profile
 { name:"Jens Sonnenborg",
   linkedin:"https://www.linkedin.com/in/sonnenborg/" },                      // skytek.dk own author page, exact title match
 { name:"Yohanna Gustafsson",
   linkedin:"https://www.linkedin.com/in/yohannagustafsson/" },               // cse.cbs.dk own team page, exact title match
 { name:"Monika Kanda",   // was all-caps in Airtable until 2026-08-10
   linkedin:"https://www.linkedin.com/in/monikakanda/" },                     // siliconvalley.um.dk + The Org
 { name:"Annelie Rådhall",
   linkedin:"https://www.linkedin.com/in/annelie-r%C3%A5dhall/" },            // boras-ink.se + nestsweden.se, exact title match
 // --- 2026-08-09 batch 4 ---
 { name:"Raymond Alves",
   linkedin:"https://www.linkedin.com/in/raymondalves" },                     // Silicon Canals + TechFundingNews name him Magic Lane co-founder/CEO
 { name:"Daniel Nordin Baker",
   linkedin:"https://www.linkedin.com/in/danielnordinbaker" },                // Big Science Sweden post: "Daniel Nordin Baker at European Spallation Source ERIC"
 { name:"Anders Rosenqvist",
   linkedin:"https://www.linkedin.com/in/andersrosenqvist/" },                // seoday.dk speaker page + Accutics Maersk case study, exact title match
 { name:"Jennifer Montague",
   linkedin:"https://www.linkedin.com/in/jennifermontague/" },                 // row renamed from "Monatgue" 2026-08-10; spelling caveat no longer needed
 { name:"Bue Fisker",
   linkedin:"https://www.linkedin.com/in/bue-fisker-b10946a6",
   bio:"NOTE: identity confirmed, but every public source puts him at KIRKBI (the Kirk Kristiansen family holding company) as Senior Investment Manager - not the LEGO Foundation as Director of Investments, which is what this row says. They are separate legal entities. Please confirm which is current." },
 // Fabio Cavaliere: handle already on the row. Bio caveat REMOVED because Auri cleared that Bio
 // by hand on 2026-08-10 - re-adding it would silently undo a deliberate edit. The underlying
 // concern still stands and lives in progress.md: Job Title "POINT OF CONTACT" and an email
 // address in the Company field mean this row is probably the submitting contact, not a speaker.
 { name:"Fabio Cavaliere",
   linkedin:"https://www.linkedin.com/in/fabio-cavaliere-1s3" },

 { name:"Nadia Lodroman",
   linkedin:"https://www.linkedin.com/in/nadia-lodroman-69499a9/",
   bio:"NOTE: identity is solid (her own site lodroman.com, headline reads Finance Transformation Consultant), BUT she is a Dublin-based independent Oracle EPM consultant, not an employee of Skytek Nordics ApS as this row's Company says. The Company field looks like it inherited the submitting partner's name. Please correct." },
];

let recs=[],offset;
do{const u=new URL(`https://api.airtable.com/v0/${BASE}/${T}`);
u.searchParams.set("view",V);u.searchParams.set("pageSize","100");
if(offset)u.searchParams.set("offset",offset);
const j=await (await fetch(u,{headers:h})).json();recs=recs.concat(j.records||[]);offset=j.offset;}while(offset);
const grill=recs.filter(r=>/Grill Session$/i.test(r.fields["Project Name"]||""));

const updates=[];
for(const f of FOUND){
  const hit=grill.find(r=>(r.fields["Full Name"]||"").trim()===f.name);
  if(!hit){console.log("NOT FOUND in grill rows:",f.name);continue;}
  // Only send the fields we actually researched. Sending bio:undefined would BLANK an existing Bio.
  const fields={"LinkedIn Handle":f.linkedin};
  if(f.bio) fields["Bio"]=f.bio;
  const had=hit.fields["LinkedIn Handle"];
  if(had===f.linkedin && (!f.bio || hit.fields["Bio"]===f.bio)){
    console.log(`unchanged:   ${f.name}`);continue;
  }
  updates.push({id:hit.id,fields});
  console.log(`will ${had?"OVERWRITE":"set"}: ${f.name}  -> ${f.linkedin}${f.bio?"  (+bio)":""}`);
  if(had && had!==f.linkedin) console.log(`             was: ${had}`);
}
console.log(`\n${updates.length} row(s) to update.`);
if(!COMMIT){console.log("DRY RUN. add --commit");process.exit(0);}

// Airtable PATCH takes max 10 records per request.
let done=0;
for(let i=0;i<updates.length;i+=10){
  const chunk=updates.slice(i,i+10);
  const r=await fetch(`https://api.airtable.com/v0/${BASE}/${T}`,{method:"PATCH",
    headers:{...h,"Content-Type":"application/json"},body:JSON.stringify({records:chunk})});
  if(!r.ok){console.error("PATCH failed",r.status,(await r.text()).slice(0,300));process.exit(1);}
  done+=chunk.length;
}
console.log("updated:",done);
