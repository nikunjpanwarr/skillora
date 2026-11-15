(function(){
var mt=document.getElementById("mt");
if(mt){var items=[["clap","Video Editing"],["pen","Graphic Design"],["wr","Content Writing"],["code","Web Development"],["cam","Photography"],["mega","Social Media"],["pres","Presentations"],["term","Coding Help"]],h="";
for(var k=0;k<2;k++)items.forEach(function(i,n){h+='<span><span style="display:inline-flex;align-items:center;gap:12px"><svg class="ic" style="width:20px;height:20px;color:'+(n%3==0?"var(--lav-i)":n%3==1?"var(--blush-i)":"var(--butter-i)")+'"><use href="#'+i[0]+'"/></svg>'+i[1]+'</span><b>✦</b></span>'});
mt.innerHTML=h;}
var b=document.getElementById("bar");
if(b){var s=function(){b.classList.toggle("s",scrollY>20)};addEventListener("scroll",s,{passive:true});s();}
document.addEventListener("click",function(e){var x=e.target.closest(".heart");if(x)x.setAttribute("aria-pressed",x.getAttribute("aria-pressed")=="true"?"false":"true")});

var bar2=document.getElementById("bar");
if(bar2){
 var nav=bar2.querySelector("nav"),right=bar2.lastElementChild,lg=right.querySelector("a.login");
 var btn=document.createElement("button");btn.type="button";btn.className="menu-btn";btn.setAttribute("aria-label","Open menu");btn.setAttribute("aria-expanded","false");
 var ICO_O='<svg class="ic" viewBox="0 0 24 24" style="width:20px;height:20px"><path d="M4 5h16M4 12h16M4 19h16"/></svg>',ICO_X='<svg class="ic" viewBox="0 0 24 24" style="width:20px;height:20px"><path d="M18 6 6 18M6 6l12 12"/></svg>';
 btn.innerHTML=ICO_O;right.appendChild(btn);
 var dr=document.createElement("div");dr.className="drawer";var box=document.createElement("div");box.className="dnav";
 nav.querySelectorAll("a").forEach(function(a){var c=document.createElement("a");c.href=a.getAttribute("href");c.textContent=a.textContent;if(a.classList.contains("on"))c.className="on";box.appendChild(c)});
 var au=document.createElement("a");au.href=lg.getAttribute("href");au.textContent=lg.textContent;au.className="dlogin";
 if(lg.textContent==="Log out")au.addEventListener("click",function(e){e.preventDefault();Skillora.logout()});
 box.appendChild(au);dr.appendChild(box);bar2.closest("header").parentNode.appendChild(dr);
 function set(o){dr.classList.toggle("on",o);btn.setAttribute("aria-expanded",o);btn.innerHTML=o?ICO_X:ICO_O}
 btn.addEventListener("click",function(){set(!dr.classList.contains("on"))});
 dr.addEventListener("click",function(e){if(e.target===dr||e.target.tagName==="A")set(false)});
 document.addEventListener("keydown",function(e){if(e.key==="Escape")set(false)});
}

// Global Toast Notification Component (Phase 13)
window.showToast = function(message, type, duration) {
  type = type || 'success';
  duration = duration || 3500;
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  toast.className = 'toast-msg ' + type;
  var icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '✦';
  toast.innerHTML = '<span style="font-weight:700">' + icon + '</span><span>' + message + '</span>';
  toast.addEventListener('click', function(){
    toast.classList.add('toast-out');
    setTimeout(function(){ if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
  });
  container.appendChild(toast);
  setTimeout(function() {
    toast.classList.add('toast-out');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 280);
  }, duration);
};
})();
