const fs=require('fs');
global.window=global;
let calls=[];
const R={hexRGB:(h)=>{const n=parseInt(String(h).replace('#',''),16);return[n>>16&255,n>>8&255,n&255].map(x=>x/255);},
  unit:{}, mm:(x,y,z,a,sx,sy,sz,rx,rz)=>({x,y,z,a,sx,sy,sz,rx,rz}),
  mat:(c,o)=>Object.assign({c},o), draw:(g,m)=>{calls.push({g,m});},
  glow:()=>{}, emit:()=>{}, rib:{line:()=>{}}, quads:{add:[]}, cam:{}, q:{parts:1}};
global.Render3D=R;
['poly','box','cone','sphere','sphereLo','torus','torusThick','hexRing','octa','rock3','cap'].forEach(k=>R.unit[k]={k});
eval(fs.readFileSync('avatar_style.js','utf8'));
eval(fs.readFileSync('avatar_model.js','utf8'));
const S=window.AvatarStyle,M=window.AvatarModel;
// walk at 150 u/s, sampling every 40ms
let x=0, tt=0, minFoot=1e9;
const rows=[];
for(let i=0;i<24;i++){
  tt+=1/25; x+=150/25;
  calls=[];
  M.draw({x,z:0,ang:0,r:16,design:0,colHex:S.CLOTHES[0].c,tt,o:{mot:{dash:0,air:0,aim:1,kick:0,reload:0},key:'w'}});
  const boots=calls.filter(c=>c.g.k==='box'&&Math.abs(c.m.sy-16*4*.048)<.01).map(c=>[+c.m.x.toFixed(0),+c.m.y.toFixed(0)]);
  boots.forEach(b=>{minFoot=Math.min(minFoot,b[1])});
  rows.push(boots.map(b=>b[0]+'@'+b[1]).join(' '));
}
console.log(rows.slice(0,12).join('\n'));
console.log('lowest boot centre y:',minFoot.toFixed(1));
