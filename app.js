const card=document.querySelector('#recorderCard');
const statusText=document.querySelector('#statusText');
const timer=document.querySelector('#timer');
const idleControls=document.querySelector('#idleControls');
const activeControls=document.querySelector('#activeControls');
const recordButton=document.querySelector('#recordButton');
const pauseButton=document.querySelector('#pauseButton');
const stopButton=document.querySelector('#stopButton');
const audioFile=document.querySelector('#audioFile');
const audioPreview=document.querySelector('#audioPreview');
const audioPlayer=document.querySelector('#audioPlayer');
const audioName=document.querySelector('#audioName');
const shareButton=document.querySelector('#shareButton');
const transcribeButton=document.querySelector('#transcribeButton');
const transcriptPanel=document.querySelector('#transcriptPanel');
const transcriptText=document.querySelector('#transcriptText');
const processingBox=document.querySelector('#processingBox');
const copyButton=document.querySelector('#copyButton');
const downloadTextButton=document.querySelector('#downloadTextButton');
const createMinutesButton=document.querySelector('#createMinutesButton');
const minutesPanel=document.querySelector('#minutesPanel');
const minutesProcessing=document.querySelector('#minutesProcessing');
const minutesText=document.querySelector('#minutesText');
const minutesError=document.querySelector('#minutesError');
const copyMinutesButton=document.querySelector('#copyMinutesButton');
const downloadMinutesButton=document.querySelector('#downloadMinutesButton');
const downloadWordButton=document.querySelector('#downloadWordButton');
const regenerateButton=document.querySelector('#regenerateButton');
const saveHistoryButton=document.querySelector('#saveHistoryButton');
const historySearch=document.querySelector('#historySearch');
const historyList=document.querySelector('#historyList');
const historyCount=document.querySelector('#historyCount');

let recorder=null,stream=null,chunks=[],elapsed=0,timerId=null,currentBlob=null,currentUrl=null,isPaused=false,wakeLock=null,activeHistoryId=null;
const HISTORY_KEY='kotonoha_minutes_history_v1';
const formatTime=(value)=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
const setStatus=(message)=>{statusText.textContent=message};

async function keepScreenAwake(){try{if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen')}catch{}}
function releaseWakeLock(){wakeLock?.release().catch(()=>{});wakeLock=null}
function startClock(){clearInterval(timerId);timerId=setInterval(()=>{if(!isPaused){elapsed+=1;timer.textContent=formatTime(elapsed)}},1000)}
function stopClock(){clearInterval(timerId);timerId=null}

async function startRecording(){
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setStatus('このブラウザでは録音できません。最新版のSafariで開いてください。');return}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    const preferred=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
    recorder=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined);
    chunks=[];elapsed=0;timer.textContent='00:00';isPaused=false;
    recorder.addEventListener('dataavailable',event=>{if(event.data.size)chunks.push(event.data)});
    recorder.addEventListener('stop',finishRecording,{once:true});
    recorder.start(1000);card.classList.add('is-recording');idleControls.classList.add('hidden');activeControls.classList.remove('hidden');
    pauseButton.textContent='一時停止';setStatus('録音中です。画面を閉じずにお使いください。');startClock();keepScreenAwake();
  }catch(error){setStatus(error?.name==='NotAllowedError'?'マイクが許可されていません。Safariのサイト設定でマイクを許可してください。':'録音を開始できませんでした。もう一度お試しください。')}
}

function pauseOrResume(){
  if(!recorder)return;
  if(recorder.state==='recording'){recorder.pause();isPaused=true;card.classList.remove('is-recording');pauseButton.textContent='再開';setStatus('録音を一時停止しています')}
  else if(recorder.state==='paused'){recorder.resume();isPaused=false;card.classList.add('is-recording');pauseButton.textContent='一時停止';setStatus('録音中です。画面を閉じずにお使いください。')}
}

function stopRecording(){if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(track=>track.stop());stopClock();releaseWakeLock()}
function finishRecording(){
  const mime=recorder?.mimeType||'audio/mp4';currentBlob=new Blob(chunks,{type:mime});
  const extension=mime.includes('mp4')?'m4a':mime.includes('webm')?'webm':'audio';
  showAudio(currentBlob,`ことのは録音_${new Date().toISOString().slice(0,19).replaceAll(':','-')}.${extension}`);
  card.classList.remove('is-recording');activeControls.classList.add('hidden');idleControls.classList.remove('hidden');setStatus('録音が完了しました');
}
function showAudio(blob,name){if(currentUrl)URL.revokeObjectURL(currentUrl);currentBlob=blob;currentUrl=URL.createObjectURL(blob);audioPlayer.src=currentUrl;audioName.textContent=name;audioPreview.classList.remove('hidden')}
audioFile.addEventListener('change',event=>{const file=event.target.files?.[0];if(file){showAudio(file,file.name);setStatus('音声ファイルを読み込みました')}});

async function shareAudio(){
  if(!currentBlob)return;
  const name=audioName.textContent||'recording.m4a';const file=new File([currentBlob],name,{type:currentBlob.type});
  try{if(navigator.canShare?.({files:[file]})){await navigator.share({title:'ことのは議事録の録音',files:[file]});return}}catch(error){if(error?.name==='AbortError')return}
  const link=document.createElement('a');link.href=currentUrl;link.download=name;link.click();setStatus('録音ファイルを保存しました');
}
async function transcribeAudio(){
  if(!currentBlob)return;
  const endpoint=window.KOTONOHA_CONFIG?.transcribeApiUrl;
  transcriptPanel.classList.remove('hidden');transcriptPanel.scrollIntoView({behavior:'smooth',block:'start'});
  if(!endpoint){setStatus('文字起こしサーバーを準備中です。公開設定が完了するまでお待ちください。');return}
  const form=new FormData();const name=audioName.textContent||'recording.m4a';
  form.append('file',new File([currentBlob],name,{type:currentBlob.type||'audio/mp4'}));form.append('language','ja');
  transcribeButton.disabled=true;processingBox.classList.remove('hidden');transcriptText.value='';setStatus('AIで文字起こししています');
  try{const response=await fetch(endpoint,{method:'POST',body:form});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'文字起こしに失敗しました');transcriptText.value=data.text||'';setStatus('文字起こしが完了しました')}
  catch(error){transcriptText.value='';setStatus(error.message||'文字起こしに失敗しました。時間をおいて再度お試しください。')}
  finally{processingBox.classList.add('hidden');transcribeButton.disabled=false}
}
async function copyTranscript(){if(!transcriptText.value)return;await navigator.clipboard.writeText(transcriptText.value);copyButton.textContent='コピー済み';setTimeout(()=>copyButton.textContent='コピー',1500)}
function downloadTranscript(){if(!transcriptText.value)return;const blob=new Blob([transcriptText.value],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`文字起こし_${new Date().toISOString().slice(0,10)}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const valueOf=id=>document.querySelector(`#${id}`).value.trim();
function formatMinutes(data){
  const list=(items,empty='なし')=>Array.isArray(items)&&items.length?items.map(item=>`- ${item}`).join('\n'):`- ${empty}`;
  const todos=Array.isArray(data.todos)&&data.todos.length?data.todos.map(item=>`- ${item.task}（担当：${item.assignee||'不明'}／期限：${item.deadline||'不明'}）`).join('\n'):'- なし';
  return `# ${data.meeting_title||'会議議事録'}\n\n日時：${data.date_time||'不明'}\n場所：${data.place||'不明'}\n出席者：${(data.attendees||[]).join('、')||'不明'}\n\n## 要約\n${data.summary||'不明'}\n\n## 議題\n${list(data.agenda,'不明')}\n\n## 主な内容\n${list(data.discussion,'不明')}\n\n## 決定事項\n${list(data.decisions)}\n\n## 課題・懸念事項\n${list(data.issues)}\n\n## ToDo\n${todos}\n\n## 重要事項\n${list(data.important_notes)}`;
}
async function createMinutes(){
  const transcript=transcriptText.value.trim();const endpoint=window.KOTONOHA_CONFIG?.minutesApiUrl;
  minutesPanel.classList.remove('hidden');minutesPanel.scrollIntoView({behavior:'smooth',block:'start'});minutesError.classList.add('hidden');
  if(!transcript){minutesError.textContent='文字起こし結果を入力してください。';minutesError.classList.remove('hidden');return}
  if(!endpoint){minutesError.textContent='議事録作成サーバーが設定されていません。';minutesError.classList.remove('hidden');return}
  createMinutesButton.disabled=true;regenerateButton.disabled=true;minutesProcessing.classList.remove('hidden');setStatus('AIで議事録を作成しています');
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript,metadata:{meeting_title:valueOf('meetingTitle'),date_time:valueOf('meetingDate'),place:valueOf('meetingPlace'),attendees:valueOf('meetingAttendees')}})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'議事録の作成に失敗しました');minutesText.value=formatMinutes(data.minutes||data);setStatus('AI議事録が完成しました。内容をご確認ください。');
  }catch(error){minutesError.textContent=error.message||'議事録の作成に失敗しました。';minutesError.classList.remove('hidden');setStatus('議事録を作成できませんでした');}
  finally{minutesProcessing.classList.add('hidden');createMinutesButton.disabled=false;regenerateButton.disabled=false}
}
async function copyMinutes(){if(!minutesText.value)return;await navigator.clipboard.writeText(minutesText.value);copyMinutesButton.textContent='コピー済み';setTimeout(()=>copyMinutesButton.textContent='コピー',1500)}
function downloadMinutes(){if(!minutesText.value)return;const blob=new Blob([minutesText.value],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`議事録_${new Date().toISOString().slice(0,10)}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const xmlEscape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}return table})();
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0}
function zipU16(value){return new Uint8Array([value&255,(value>>>8)&255])}
function zipU32(value){return new Uint8Array([value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255])}
function joinBytes(parts){const size=parts.reduce((sum,part)=>sum+part.length,0);const output=new Uint8Array(size);let offset=0;for(const part of parts){output.set(part,offset);offset+=part.length}return output}
function createZip(files){
  const encoder=new TextEncoder(),locals=[],centrals=[];let offset=0;const now=new Date();const dosTime=((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1))&0xffff;const dosDate=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate())&0xffff;
  for(const file of files){const name=encoder.encode(file.name),data=encoder.encode(file.content),crc=crc32(data);const local=joinBytes([zipU32(0x04034b50),zipU16(20),zipU16(0x0800),zipU16(0),zipU16(dosTime),zipU16(dosDate),zipU32(crc),zipU32(data.length),zipU32(data.length),zipU16(name.length),zipU16(0),name,data]);locals.push(local);centrals.push(joinBytes([zipU32(0x02014b50),zipU16(20),zipU16(20),zipU16(0x0800),zipU16(0),zipU16(dosTime),zipU16(dosDate),zipU32(crc),zipU32(data.length),zipU32(data.length),zipU16(name.length),zipU16(0),zipU16(0),zipU16(0),zipU16(0),zipU32(0),zipU32(offset),name]));offset+=local.length}
  const central=joinBytes(centrals);return joinBytes([...locals,central,zipU32(0x06054b50),zipU16(0),zipU16(0),zipU16(files.length),zipU16(files.length),zipU32(central.length),zipU32(offset),zipU16(0)])
}
function createWordDocument(){
  const paragraphs=minutesText.value.split(/\r?\n/).map(line=>{const heading=line.startsWith('# '),subheading=line.startsWith('## ');const text=line.replace(/^#{1,2}\s+/,'');const bold=heading||subheading?'<w:b/>':'';const size=heading?'32':subheading?'26':'22';return `<w:p><w:pPr>${heading?'<w:jc w:val="center"/>':''}<w:spacing w:after="120"/></w:pPr><w:r><w:rPr>${bold}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:rFonts w:ascii="Yu Mincho" w:eastAsia="游明朝"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text||' ')}</w:t></w:r></w:p>`}).join('');
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  return createZip([{name:'[Content_Types].xml',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},{name:'_rels/.rels',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},{name:'word/document.xml',content:documentXml}]);
}
function downloadWord(){if(!minutesText.value.trim()){minutesError.textContent='Wordに保存する議事録がありません。';minutesError.classList.remove('hidden');return}const bytes=createWordDocument();const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});const url=URL.createObjectURL(blob);const link=document.createElement('a');const title=(valueOf('meetingTitle')||'会議').replace(/[\\/:*?"<>|]/g,'_');const date=(valueOf('meetingDate')||new Date().toISOString()).slice(0,10);link.href=url;link.download=`${date}_${title}_議事録.docx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);setStatus('Wordファイルを作成しました')}
function getHistory(){try{const data=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
function setHistory(items){localStorage.setItem(HISTORY_KEY,JSON.stringify(items))}
function saveToHistory(){
  if(!minutesText.value.trim()){minutesError.textContent='保存する議事録がありません。';minutesError.classList.remove('hidden');return}
  const items=getHistory();const now=new Date().toISOString();const item={id:activeHistoryId||crypto.randomUUID?.()||String(Date.now()),title:valueOf('meetingTitle')||'名称未設定の会議',date:valueOf('meetingDate'),place:valueOf('meetingPlace'),attendees:valueOf('meetingAttendees'),transcript:transcriptText.value,minutes:minutesText.value,duration:timer.textContent,createdAt:now,updatedAt:now};
  const index=items.findIndex(saved=>saved.id===item.id);if(index>=0){item.createdAt=items[index].createdAt;items[index]=item}else items.unshift(item);
  setHistory(items);activeHistoryId=item.id;saveHistoryButton.textContent='保存しました';setTimeout(()=>saveHistoryButton.textContent='端末に保存',1500);setStatus('議事録をこの端末に保存しました');renderHistory();
}
function renderHistory(){
  const query=historySearch.value.trim().toLowerCase();const all=getHistory();const items=all.filter(item=>`${item.title} ${item.attendees} ${item.minutes} ${item.transcript}`.toLowerCase().includes(query));historyCount.textContent=`${all.length}件`;historyList.replaceChildren();
  if(!items.length){const empty=document.createElement('p');empty.className='empty-history';empty.textContent=query?'検索に一致する議事録はありません。':'保存した議事録はまだありません。';historyList.append(empty);return}
  items.forEach(item=>{const article=document.createElement('article');article.className='history-item';const title=document.createElement('h3');title.textContent=item.title||'名称未設定の会議';const detail=document.createElement('p');detail.textContent=`${item.date?item.date.replace('T',' '):new Date(item.createdAt).toLocaleString('ja-JP')} · 録音 ${item.duration||'--:--'}`;const actions=document.createElement('div');actions.className='history-actions';const open=document.createElement('button');open.className='open-history';open.textContent='開く';open.addEventListener('click',()=>openHistory(item.id));const remove=document.createElement('button');remove.className='delete-history';remove.textContent='削除';remove.addEventListener('click',()=>deleteHistory(item.id));actions.append(open,remove);article.append(title,detail,actions);historyList.append(article)});
}
function openHistory(id){const item=getHistory().find(saved=>saved.id===id);if(!item)return;activeHistoryId=id;document.querySelector('#meetingTitle').value=item.title||'';document.querySelector('#meetingDate').value=item.date||'';document.querySelector('#meetingPlace').value=item.place||'';document.querySelector('#meetingAttendees').value=item.attendees||'';transcriptText.value=item.transcript||'';minutesText.value=item.minutes||'';transcriptPanel.classList.remove('hidden');minutesPanel.classList.remove('hidden');minutesPanel.scrollIntoView({behavior:'smooth',block:'start'});setStatus('保存済みの議事録を開きました')}
function deleteHistory(id){const item=getHistory().find(saved=>saved.id===id);if(!item||!confirm(`「${item.title}」を端末から削除しますか？`))return;setHistory(getHistory().filter(saved=>saved.id!==id));if(activeHistoryId===id)activeHistoryId=null;renderHistory();setStatus('議事録を端末から削除しました')}
recordButton.addEventListener('click',startRecording);pauseButton.addEventListener('click',pauseOrResume);stopButton.addEventListener('click',stopRecording);shareButton.addEventListener('click',shareAudio);
transcribeButton.addEventListener('click',transcribeAudio);copyButton.addEventListener('click',copyTranscript);downloadTextButton.addEventListener('click',downloadTranscript);
createMinutesButton.addEventListener('click',createMinutes);regenerateButton.addEventListener('click',createMinutes);copyMinutesButton.addEventListener('click',copyMinutes);downloadMinutesButton.addEventListener('click',downloadMinutes);
downloadWordButton.addEventListener('click',downloadWord);
saveHistoryButton.addEventListener('click',saveToHistory);historySearch.addEventListener('input',renderHistory);renderHistory();
window.addEventListener('beforeunload',event=>{if(recorder&&recorder.state!=='inactive'){event.preventDefault();event.returnValue=''}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&recorder?.state==='recording')keepScreenAwake()});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
