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
  updates.push({id:hit.id,fields:{"LinkedIn Handle":f.linkedin,"Bio":f.bio}});
  console.log(`will update: ${f.name}  -> ${f.linkedin}`);
}
if(!COMMIT){console.log("\nDRY RUN. add --commit");process.exit(0);}
const r=await fetch(`https://api.airtable.com/v0/${BASE}/${T}`,{method:"PATCH",
  headers:{...h,"Content-Type":"application/json"},body:JSON.stringify({records:updates})});
if(!r.ok){console.error("PATCH failed",r.status,(await r.text()).slice(0,300));process.exit(1);}
console.log("\nupdated:",updates.length);
