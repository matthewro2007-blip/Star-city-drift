(function(){
  var btn=document.querySelector('.menu-btn'),nav=document.getElementById('navlinks');
  btn.addEventListener('click',function(){var o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',o);});
  nav.addEventListener('click',function(e){if(e.target.tagName==='A'){nav.classList.remove('open');btn.setAttribute('aria-expanded','false');}});
  var links=[].slice.call(document.querySelectorAll('.shots a')),lb=document.getElementById('lb'),img=lb.querySelector('img'),cap=lb.querySelector('figcaption'),i=0,last;
  function show(n){i=(n+links.length)%links.length;var a=links[i];img.src=a.href;img.alt=a.querySelector('img').alt;cap.textContent=a.dataset.cap||'';}
  function open(n){last=document.activeElement;show(n);lb.hidden=false;document.body.style.overflow='hidden';lb.querySelector('.lb-close').focus();}
  function close(){lb.hidden=true;document.body.style.overflow='';if(last)last.focus();}
  links.forEach(function(a,n){a.addEventListener('click',function(e){e.preventDefault();open(n);});});
  lb.querySelector('.lb-close').onclick=close;
  lb.querySelector('.lb-prev').onclick=function(){show(i-1);};
  lb.querySelector('.lb-next').onclick=function(){show(i+1);};
  lb.addEventListener('click',function(e){if(e.target===lb)close();});
  document.addEventListener('keydown',function(e){if(lb.hidden)return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(i-1);if(e.key==='ArrowRight')show(i+1);
    if(e.key==='Tab'){var f=lb.querySelectorAll('button'),a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}});
})();
