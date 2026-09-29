/* 작성본은 서버의 수정 인증을 통과한 세션에서만 표시한다. */
(function(root){
  'use strict';
  var editor=false, editorKey='', publicState=null;
  function managed(s){
    if(s&&s.publication&&s.publication.managed)return true;
    var m=s&&s.meeting;if(!m)return false;
    var ym=Number(m.year)*100+Number(m.month);
    return ym>202609||(ym===202609&&m.body!=='임차'&&(m.type!=='임시'||String(m.date||'')>='2026-09-29'));
  }
  function key(){return root.AdminGate?root.AdminGate.savedKey():'';}
  function isEditor(){return editor&&!!key()&&key()===editorKey;}
  function canShow(s){return !managed(s)||isEditor()||s===publicState;}
  function publicItem(item){
    try{return !managed(JSON.parse(item.json||'{}'))||!!(item.publication&&item.publication.public);}catch(_){return false;}
  }
  root.Publication={managed:managed,isEditor:isEditor,canShow:canShow,publicItem:publicItem,
    setEditor:function(ok,k){editor=!!ok;editorKey=ok?k:'';if(ok)publicState=null;},
    accept:function(s,item){publicState=!isEditor()&&item&&item.publication&&item.publication.public?s:null;},
    render:function(){
      var box=document.getElementById('publicationBar');if(!box)return;
      box.hidden=!isEditor();if(box.hidden)return;
      var p=state.publication||{};
      box.innerHTML='<b>회의록</b> · '+(!managed(state)?'기존 공개 회의록':
        (p.publishedAt?'발행됨 · 수정본은 재발행 후 공개':'미발행 · 편집자만 열람'))+
        (managed(state)?' <button class="btn gold" onclick="Cloud.publishCurrent()">'+(p.publishedAt?'다시 발행':'발행')+'</button>':'');
    }
  };
  setInterval(function(){
    if(editor&&!isEditor()){
      editor=false;editorKey='';publicState=null;
      if(root.Cloud)Cloud._invalidate();
      if(root.renderPreview)renderPreview();
      if(root.Cloud)Cloud.refreshList();
    }
  },1000);
})(window);
