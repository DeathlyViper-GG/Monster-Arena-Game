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
const H=S.heightFor(16);
console.log('H',H.toFixed(1));
// --- aim pose: hands vs the drawn weapon line (gun centre = hb-4)
calls=[];
const ret=M.draw({x:0,z:0,ang:0,r:16,design:0,colHex:S.CLOTHES[0].c,tt:1.2,o:{mot:{dash:0,air:0,aim:1,kick:0,reload:0},key:'a'}});
const hands=calls.filter(c=>c.g.k==='sphereLo'&&Math.abs(c.m.sx-H*.040)<.01);
console.log('hb (gun height)',ret.hb.toFixed(1),'gun centre',(ret.hb-4).toFixed(1));
console.log('hands',hands.map(c=>[c.m.x.toFixed(1),c.m.y.toFixed(1),c.m.z.toFixed(1)]));
