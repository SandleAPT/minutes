(function(){
  var role='';
  function allowed(sub){return sub==='rules'||sub==='elections'||(sub==='contracts'&&(role==='view'||role==='edit'))||((sub==='notices'||sub==='checks')&&role==='edit');}
  var auth=PortalAccess.create({storage:localStorage,fetch:window.fetch.bind(window),
    url:'https://script.google.com/macros/s/AKfycbyhpE-DB5WAAEx7uqTCPwU-e0sPKuupkYN3YoQWALiFWe0IHFNh1y91e1VNtDmMxxoxLA/exec',token:'ITDXaUBDTmrz6DbQ3tv9R',
    change:function(next){role=next;if(window.Notices)Notices.accessChanged();}});
  window.NoticeAccess={allowed:allowed,start:function(){auth.restore(false);}};
  function check(){auth.restore(false);}
  window.addEventListener('storage',function(event){if(!event.key||['sandle_admin_key','sandle_admin_unlock_at','sandle_admin_trust'].indexOf(event.key)>=0)check();});
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)check();});
  setInterval(check,300000);setInterval(function(){auth.expire();},1000);
})();
