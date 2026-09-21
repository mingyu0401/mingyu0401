var fs = require('fs');
var path = require('path');

var outDir = process.argv[2] || 'dist';
fs.mkdirSync(outDir, { recursive: true });

var LINE1 = '明雨 Mingyu · Android 开发者 · EMOO 作者';
var LINE2 = 'Keep building, keep playing.';

var html = '<!doctype html><html><head><meta charset="utf-8"><style>'+
'*{margin:0;padding:0;box-sizing:border-box}'+
'body{width:880px;height:192px;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;position:relative}'+
'.g1{position:absolute;inset:0;background:linear-gradient(135deg,#0a0a1a 0%,#1a0533 50%,#0a0a1a 100%);background-size:400% 400%;animation:gShift 8s ease infinite}'+
'.g2{position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 70% 40%,rgba(255,255,255,0.03) 0%,transparent 70%);animation:fPulse 8s ease-in-out infinite}'+
'.g3{position:absolute;inset:0;background:radial-gradient(ellipse 40% 60% at 20% 60%,rgba(255,255,255,0.02) 0%,transparent 60%);animation:fPulse 8s ease-in-out infinite reverse}'+
'.glow{position:absolute;inset:0;background:radial-gradient(ellipse 100% 60% at 50% 100%,rgba(255,255,255,0.04) 0%,transparent 60%)}'+
'@keyframes gShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}'+
'@keyframes fPulse{0%,100%{opacity:0.5}50%{opacity:1}}'+
'.stars{position:absolute;inset:0;z-index:1}'+
'.s{position:absolute;background:#fff;border-radius:50%;animation:twinkle var(--d) ease-in-out infinite}'+
'@keyframes twinkle{0%,100%{opacity:var(--a)}50%{opacity:calc(var(--a)*0.2)}}'+
'.txt{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;pointer-events:none}'+
'.l1{font-size:28px;font-weight:700;letter-spacing:0.05em;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,0.9);white-space:nowrap}'+
'.l1 span{display:inline-block;width:2px;height:1.1em;background:rgba(255,255,255,0.7);vertical-align:middle;margin-left:2px;animation:blink 0.7s step-end infinite}'+
'@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}'+
'.l2{margin-top:2px;font-size:15px;color:rgba(255,255,255,0.55);font-style:italic;opacity:0;animation:fadeIn 8s ease forwards}'+
'@keyframes fadeIn{0%,55%{opacity:0}70%,100%{opacity:1}}'+
'.accent{width:100px;height:2px;background:linear-gradient(90deg,transparent,#ff7fa5,transparent);opacity:0;animation:slideIn 8s ease forwards}'+
'@keyframes slideIn{0%,45%{opacity:0;transform:scaleX(0)}65%,100%{opacity:1;transform:scaleX(1)}}'+
'</style></head><body>'+
'<div class="g1" id="g1"></div><div class="g2"></div><div class="g3"></div><div class="glow"></div>'+
'<div class="stars" id="stars"></div>'+
'<div class="txt"><div class="l1" id="l1"><span>&nbsp;</span></div>'+
'<div class="l2">'+LINE2+'</div><div class="accent" id="accent"></div></div>'+
'<script>'+
'var colors=[{bg1:"#0a0a1a",bg2:"#1a0533",accent:"#ff7fa5"},'+
'{bg1:"#030d1a",bg2:"#0a2040",accent:"#6e82ff"},'+
'{bg1:"#0d1a0d",bg2:"#1a330a",accent:"#40c463"},'+
'{bg1:"#1a0d05",bg2:"#331a0a",accent:"#f9a86c"}];'+
'var ci=0;function cycle(){'+
'document.getElementById("g1").style.background="linear-gradient(135deg,"+colors[ci].bg1+" 0%,"+colors[ci].bg2+" 50%,"+colors[ci].bg1+" 100%)";'+
'document.getElementById("accent").style.background="linear-gradient(90deg,transparent,"+colors[ci].accent+",transparent)";'+
'ci=(ci+1)%colors.length;}'+
'cycle();setInterval(cycle,8000);'+
'var text="'+LINE1+'";var l1=document.getElementById("l1");var idx=0;'+
'function type(){if(idx<=text.length){l1.innerHTML=text.substring(0,idx)+"<span>&nbsp;</span>";idx++;setTimeout(type,80);}else{'+
'l1.innerHTML=text+"<span>&nbsp;</span>";setTimeout(function(){var s=l1.querySelector("span");if(s)s.style.display="none";},800);}}'+
'setTimeout(type,300);'+
'var stars=document.getElementById("stars");'+
'for(var i=0;i<50;i++){var d=1.5+Math.random()*3;'+
'var s=document.createElement("div");s.className="s";'+
's.style.cssText="width:"+d+"px;height:"+d+"px;left:"+(Math.random()*100)+"%;top:"+(Math.random()*100)+"%;--d:"+(2+Math.random()*3)+"s;--a:"+(0.2+Math.random()*0.4);'+
'stars.appendChild(s);}'+
'<\/script></body></html>';

var outPath = path.join(outDir, 'banner.html');
fs.writeFileSync(outPath, html);
console.log('Banner HTML written to:', outPath, '(size:', html.length + ')');
