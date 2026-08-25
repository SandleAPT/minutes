/* 포털 끼움 모드 (v61): ?embed=1 이면 왼쪽 메뉴를 숨긴다(깜빡임 방지를 위해 가장 먼저) */try{if(new URLSearchParams(location.search).get("embed")==="1")document.documentElement.classList.add("embedded");}catch(e){}
