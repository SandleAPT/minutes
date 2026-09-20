const fs=require('fs'),vm=require('vm'),assert=require('assert');
const props=new Map([['ADMIN_KEY','edit-test'],['VIEW_KEY','view-test'],['TOKEN','token-test']]);
const context={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},ContentService:{createTextOutput:text=>({setMimeType:()=>JSON.parse(text)}),MimeType:{JSON:'json'}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../scripts/gas/main-backend.gs','utf8'),context);context.logAuth_=()=>{};
const url='https://script.google.com/macros/s/test_private/exec';
const verify=(key,candidate,token='token-test')=>context.doPost({postData:{contents:JSON.stringify({action:'verify',adminKey:key,token,privateStoreUrl:candidate})}});
for(const key of ['bad','view-test']){const r=verify(key,url);assert(!r.privateStoreUrl);assert(!props.has('PRIVATE_STORE_URL'));}
assert(!verify('edit-test',url,'bad-token').ok);assert(!props.has('PRIVATE_STORE_URL'));
assert.equal(verify('edit-test','https://evil.test/exec').privateStoreUrl,'');
assert.equal(verify('edit-test',url).privateStoreUrl,url);
assert.equal(verify('edit-test').privateStoreUrl,url);
assert.equal(verify('edit-test','https://script.google.com/macros/s/other/exec').privateStoreUrl,url);
assert(!verify('view-test').privateStoreUrl);assert(!verify('bad').privateStoreUrl);
console.log('Cloud registration: edit only, new device, no overwrite, invalid URL/token passed');
