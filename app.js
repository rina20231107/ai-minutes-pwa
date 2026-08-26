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
const apiTranscribeButton=document.querySelector('#apiTranscribeButton');
const transcriptPanel=document.querySelector('#transcriptPanel');
const transcriptText=document.querySelector('#transcriptText');
const processingBox=document.querySelector('#processingBox');
const processingTitle=document.querySelector('#processingTitle');
const processingDetail=document.querySelector('#processingDetail');
const transcriptionError=document.querySelector('#transcriptionError');
const copyButton=document.querySelector('#copyButton');
const downloadTextButton=document.querySelector('#downloadTextButton');
const createMinutesButton=document.querySelector('#createMinutesButton');
const referenceFiles=document.querySelector('#referenceFiles');
const referenceCount=document.querySelector('#referenceCount');
const referenceStatus=document.querySelector('#referenceStatus');
const referenceList=document.querySelector('#referenceList');
const referenceText=document.querySelector('#referenceText');
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
const micCheckOverlay=document.querySelector('#micCheckOverlay');
const micCheckTitle=document.querySelector('#micCheckTitle');
const micCheckMessage=document.querySelector('#micCheckMessage');
const micDetectedName=document.querySelector('#micDetectedName');
const micCheckButton=document.querySelector('#micCheckButton');
const useInternalMicButton=document.querySelector('#useInternalMicButton');
const inputDevice=document.querySelector('#inputDevice');
const inputDeviceName=document.querySelector('#inputDeviceName');

let recorder=null,stream=null,chunks=[],elapsed=0,timerId=null,currentBlob=null,currentUrl=null,isPaused=false,wakeLock=null,activeHistoryId=null,speechRecognition=null,recognitionFinalText='',keepRecognizing=false,selectedAudioFile=false,referenceDocuments=[],recordingSegments=[],externalTranscriptionParts=[],recordingActive=false,isRotatingSegment=false,segmentTimeout=null,segmentMime='audio/mp4';
const HISTORY_KEY='kotonoha_minutes_history_v1';
const MAX_REFERENCE_FILES=3,MAX_REFERENCE_FILE_SIZE=10*1024*1024,MAX_REFERENCE_TEXT=60000;
const MAX_TRANSCRIPTION_BYTES=25*1024*1024,SEGMENT_DURATION_MS=10*60*1000;
const formatTime=(value)=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
const setStatus=(message)=>{statusText.textContent=message};
const bluetoothNamePattern=/powerconf|anker|bluetooth|airpods|headset|hands[- ]?free|イヤホン|ヘッドセット/i;
const internalNamePattern=/iphone|ipad|built[- ]?in|内蔵|default/i;

function reportedMicName(track,devices=[]){const settings=track?.getSettings?.()||{};const match=devices.find(device=>device.kind==='audioinput'&&device.deviceId===settings.deviceId);return (match?.label||track?.label||'').trim()}
function closeMicCheck(message){micCheckOverlay.classList.add('hidden');document.body.classList.remove('mic-check-open');if(message)setStatus(message)}
function showMicResult(name,type){
  micDetectedName.classList.remove('hidden');micDetectedName.textContent=name||'機器名を取得できませんでした';useInternalMicButton.classList.add('hidden');
  if(type==='bluetooth'){micCheckTitle.textContent='Bluetoothマイクを確認しました';micCheckMessage.textContent='Bluetoothマイクを使用して録音します。';micCheckButton.textContent='録音画面へ進む';micCheckButton.dataset.action='continue';inputDevice.classList.add('is-bluetooth');inputDeviceName.textContent=name;return}
  if(type==='internal'){micCheckTitle.textContent='iPhoneの内蔵マイクが選択されています';micCheckMessage.textContent='PowerConfを使用する場合は、先にBluetooth設定で接続してください。接続後、この画面で再確認できます。';micCheckButton.textContent='接続後に再確認';micCheckButton.dataset.action='check';useInternalMicButton.textContent='内蔵マイクを使用する';useInternalMicButton.classList.remove('hidden');inputDevice.classList.remove('is-bluetooth');inputDeviceName.textContent=name;return}
  micCheckTitle.textContent='使用中のマイクを判定できませんでした';micCheckMessage.textContent='Bluetooth接続を確認するか、短いテスト録音で入力先を確認してください。';micCheckButton.textContent='再確認';micCheckButton.dataset.action='check';useInternalMicButton.textContent='このまま進む';useInternalMicButton.classList.remove('hidden');inputDevice.classList.remove('is-bluetooth');inputDeviceName.textContent='Safariでは判定できません';
}
async function checkInputMicrophone(){
  if(micCheckButton.dataset.action==='continue'){closeMicCheck('Bluetoothマイクを使用する準備ができました');return}
  if(!navigator.mediaDevices?.getUserMedia){showMicResult('', 'unknown');return}
  micCheckButton.disabled=true;micCheckButton.textContent='確認しています…';micDetectedName.classList.add('hidden');useInternalMicButton.classList.add('hidden');
  let testStream;
  try{testStream=await navigator.mediaDevices.getUserMedia({audio:true});const track=testStream.getAudioTracks()[0];const devices=await navigator.mediaDevices.enumerateDevices().catch(()=>[]);const name=reportedMicName(track,devices);const type=bluetoothNamePattern.test(name)?'bluetooth':internalNamePattern.test(name)?'internal':'unknown';showMicResult(name,type)}
  catch(error){micCheckTitle.textContent='マイクを確認できませんでした';micCheckMessage.textContent=error?.name==='NotAllowedError'?'Safariのサイト設定でマイクを許可してから再確認してください。':'Bluetooth接続とSafariのマイク設定を確認してください。';micCheckButton.textContent='再確認';micCheckButton.dataset.action='check'}
  finally{testStream?.getTracks().forEach(track=>track.stop());micCheckButton.disabled=false}
}

async function keepScreenAwake(){try{if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen')}catch{}}
function releaseWakeLock(){wakeLock?.release().catch(()=>{});wakeLock=null}
function startClock(){clearInterval(timerId);timerId=setInterval(()=>{if(!isPaused){elapsed+=1;timer.textContent=formatTime(elapsed)}},1000)}
function stopClock(){clearInterval(timerId);timerId=null}

function speechRecognitionClass(){return window.SpeechRecognition||window.webkitSpeechRecognition}
function startLocalTranscription(){
  const Recognition=speechRecognitionClass();
  recognitionFinalText='';transcriptText.value='';selectedAudioFile=false;
  processingTitle.textContent='iPhoneが音声を認識しています';processingDetail.textContent='録音と同時に文字起こししています';
  transcriptPanel.classList.remove('hidden');processingBox.classList.remove('hidden');
  if(!Recognition){processingBox.classList.add('hidden');setStatus('このSafariでは音声認識を利用できません。文字起こし欄へ手入力してください。');return}
  keepRecognizing=true;speechRecognition=new Recognition();speechRecognition.lang='ja-JP';speechRecognition.continuous=true;speechRecognition.interimResults=true;
  speechRecognition.addEventListener('result',event=>{let interim='';for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0]?.transcript||'';if(event.results[i].isFinal)recognitionFinalText+=`${text} `;else interim+=text}transcriptText.value=`${recognitionFinalText}${interim}`.trim()});
  speechRecognition.addEventListener('error',event=>{if(event.error==='not-allowed')setStatus('音声認識が許可されていません。Safariの設定をご確認ください。')});
  speechRecognition.addEventListener('end',()=>{if(keepRecognizing&&recorder?.state==='recording')setTimeout(()=>{try{speechRecognition.start()}catch{}},250)});
  try{speechRecognition.start()}catch{processingBox.classList.add('hidden');setStatus('音声認識を開始できませんでした。文字起こし欄へ手入力してください。')}
}
function stopLocalTranscription(){keepRecognizing=false;try{speechRecognition?.stop()}catch{}processingBox.classList.add('hidden')}

async function startRecording(){
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setStatus('このブラウザでは録音できません。最新版のSafariで開いてください。');return}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    const activeTrack=stream.getAudioTracks()[0];const activeDevices=await navigator.mediaDevices.enumerateDevices().catch(()=>[]);const activeName=reportedMicName(activeTrack,activeDevices);inputDeviceName.textContent=activeName||'iPhoneが選択した音声入力';inputDevice.classList.toggle('is-bluetooth',bluetoothNamePattern.test(activeName));
    segmentMime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type))||'';
    recordingSegments=[];externalTranscriptionParts=[];recordingActive=true;isRotatingSegment=false;elapsed=0;timer.textContent='00:00';isPaused=false;selectedAudioFile=false;transcriptionError.classList.add('hidden');
    startRecorderSegment();startLocalTranscription();card.classList.add('is-recording');idleControls.classList.add('hidden');activeControls.classList.remove('hidden');
    pauseButton.textContent='一時停止';setStatus('録音とiPhone音声認識による文字起こしを実行中です。');startClock();keepScreenAwake();
  }catch(error){setStatus(error?.name==='NotAllowedError'?'マイクが許可されていません。Safariのサイト設定でマイクを許可してください。':'録音を開始できませんでした。もう一度お試しください。')}
}

function scheduleSegmentRotation(){clearTimeout(segmentTimeout);segmentTimeout=setTimeout(()=>{if(recordingActive&&recorder?.state==='recording'){isRotatingSegment=true;recorder.stop()}},SEGMENT_DURATION_MS)}
function startRecorderSegment(){
  chunks=[];recorder=new MediaRecorder(stream,segmentMime?{mimeType:segmentMime}:undefined);
  recorder.addEventListener('dataavailable',event=>{if(event.data.size)chunks.push(event.data)});
  recorder.addEventListener('stop',()=>{const mime=recorder?.mimeType||segmentMime||'audio/mp4';const blob=new Blob(chunks,{type:mime});if(blob.size)recordingSegments.push(blob);if(recordingActive&&isRotatingSegment){isRotatingSegment=false;startRecorderSegment();setStatus(`録音中です（長時間録音を${recordingSegments.length+1}区間に分割中）`)}else finishRecording()},{once:true});
  recorder.start(1000);scheduleSegmentRotation();
}

function pauseOrResume(){
  if(!recorder)return;
  if(recorder.state==='recording'){clearTimeout(segmentTimeout);recorder.pause();keepRecognizing=false;try{speechRecognition?.stop()}catch{}processingBox.classList.add('hidden');isPaused=true;card.classList.remove('is-recording');pauseButton.textContent='再開';setStatus('録音と文字起こしを一時停止しています')}
  else if(recorder.state==='paused'){recorder.resume();scheduleSegmentRotation();keepRecognizing=true;try{speechRecognition?.start();processingBox.classList.remove('hidden')}catch{}isPaused=false;card.classList.add('is-recording');pauseButton.textContent='一時停止';setStatus('録音と文字起こしを再開しました。')}
}

function stopRecording(){recordingActive=false;isRotatingSegment=false;clearTimeout(segmentTimeout);stopLocalTranscription();if(recorder&&recorder.state!=='inactive')recorder.stop();else finishRecording();stopClock();releaseWakeLock()}
function finishRecording(){
  stream?.getTracks().forEach(track=>track.stop());const mime=recordingSegments[0]?.type||segmentMime||'audio/mp4';currentBlob=recordingSegments.length===1?recordingSegments[0]:new Blob(recordingSegments,{type:mime});
  const extension=mime.includes('mp4')?'m4a':mime.includes('webm')?'webm':'audio';
  const name=`ことのは録音_${new Date().toISOString().slice(0,19).replaceAll(':','-')}.${extension}`;if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(recordingSegments[0]||currentBlob);audioPlayer.src=currentUrl;audioName.textContent=recordingSegments.length>1?`${name}（${recordingSegments.length}区間・再生は先頭区間）`:name;audioPreview.classList.remove('hidden');
  card.classList.remove('is-recording');activeControls.classList.add('hidden');idleControls.classList.remove('hidden');setStatus(recordingSegments.length>1?`録音が完了しました。OpenAI文字起こしは${recordingSegments.length}区間を順番に処理します。`:'録音が完了しました');
}
function showAudio(blob,name){if(currentUrl)URL.revokeObjectURL(currentUrl);currentBlob=blob;currentUrl=URL.createObjectURL(blob);audioPlayer.src=currentUrl;audioName.textContent=name;audioPreview.classList.remove('hidden')}
audioFile.addEventListener('change',event=>{const file=event.target.files?.[0];if(file){selectedAudioFile=true;recordingSegments=[];externalTranscriptionParts=[];showAudio(file,file.name);setStatus(file.size>MAX_TRANSCRIPTION_BYTES?'音声ファイルを読み込みました。OpenAI文字起こし時に自動分割します。':'音声ファイルを読み込みました。')}});

function setReferenceStatus(message,isError=false){referenceStatus.textContent=message;referenceStatus.classList.toggle('is-error',isError)}
function renderReferences(){
  referenceCount.textContent=`${referenceDocuments.length} / ${MAX_REFERENCE_FILES}件`;referenceList.replaceChildren();
  if(!referenceDocuments.length){setReferenceStatus('資料はまだ選択されていません。');return}
  setReferenceStatus(`${referenceDocuments.length}件の資料をAIが参照できます。`);
  referenceDocuments.forEach(documentData=>{const item=document.createElement('div');item.className='reference-item';const detail=document.createElement('div');const name=document.createElement('strong');name.textContent=documentData.name;const info=document.createElement('small');info.textContent=`読み取り済み · ${documentData.text.length.toLocaleString('ja-JP')}文字`;detail.append(name,info);const remove=document.createElement('button');remove.type='button';remove.className='reference-remove';remove.textContent='削除';remove.addEventListener('click',()=>{referenceDocuments=referenceDocuments.filter(item=>item.id!==documentData.id);syncReferenceText();renderReferences()});item.append(detail,remove);referenceList.append(item)})
}
function syncReferenceText(){referenceText.value=referenceDocuments.map(item=>`【${item.name}】\n${item.text}`).join('\n\n')}
async function extractReferenceText(file){
  const extension=file.name.split('.').pop()?.toLowerCase();const buffer=await file.arrayBuffer();
  if(extension==='docx'){if(!window.mammoth)throw new Error('Word読取機能を読み込めませんでした');const result=await window.mammoth.extractRawText({arrayBuffer:buffer});return result.value}
  if(extension==='xlsx'){if(!window.XLSX)throw new Error('Excel読取機能を読み込めませんでした');const workbook=window.XLSX.read(buffer,{type:'array'});return workbook.SheetNames.map(sheetName=>`【シート: ${sheetName}】\n${window.XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName],{FS:'\t'})}`).join('\n\n')}
  if(extension==='pdf'){if(!window.pdfjsLib)throw new Error('PDF読取機能を読み込めませんでした');window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(buffer)}).promise;const pages=[];for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){const page=await pdf.getPage(pageNumber);const content=await page.getTextContent();pages.push(`【${pageNumber}ページ】\n${content.items.map(item=>item.str).join(' ')}`)}return pages.join('\n\n')}
  throw new Error('対応形式はWord（.docx）、Excel（.xlsx）、PDFです')
}
async function addReferenceFiles(event){
  const selected=Array.from(event.target.files||[]);referenceFiles.value='';
  if(!selected.length)return;
  if(referenceDocuments.length+selected.length>MAX_REFERENCE_FILES){setReferenceStatus(`参考資料は合計${MAX_REFERENCE_FILES}件までです。`,true);return}
  for(const file of selected){
    if(file.size>MAX_REFERENCE_FILE_SIZE){setReferenceStatus(`「${file.name}」は10MBを超えています。`,true);continue}
    if(referenceDocuments.some(item=>item.name===file.name&&item.size===file.size)){setReferenceStatus(`「${file.name}」はすでに追加されています。`,true);continue}
    setReferenceStatus(`「${file.name}」を読み取っています…`);
    try{const text=(await extractReferenceText(file)).replace(/\u0000/g,'').trim();if(!text)throw new Error('文字を抽出できませんでした');referenceDocuments.push({id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,name:file.name,type:file.type,size:file.size,text:text.slice(0,MAX_REFERENCE_TEXT)})}
    catch(error){setReferenceStatus(`「${file.name}」: ${error.message}`,true)}
  }
  syncReferenceText();renderReferences()
}

async function shareAudio(){
  if(!currentBlob)return;
  const base=(audioName.textContent||'recording.m4a').replace(/（.*$/,'');const extension=base.split('.').pop()||'m4a';const parts=recordingSegments.length?recordingSegments:[currentBlob];const files=parts.map((blob,index)=>new File([blob],parts.length>1?base.replace(`.${extension}`,`_${String(index+1).padStart(2,'0')}.${extension}`):base,{type:blob.type}));
  try{if(navigator.canShare?.({files})){await navigator.share({title:'ことのは議事録の録音',files});return}}catch(error){if(error?.name==='AbortError')return}
  files.forEach(file=>{const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500)});setStatus('録音ファイルを保存しました');
}
function showTranscript(){transcriptPanel.classList.remove('hidden');transcriptPanel.scrollIntoView({behavior:'smooth',block:'start'});if(selectedAudioFile&&!transcriptText.value)setStatus('選択した音声ファイルは自動認識できません。文字起こし欄へ内容を入力してください。')}
async function splitExternalMp4(blob){
  const name=(audioName.textContent||'').toLowerCase();
  if(!/\.(m4a|mp4)$/.test(name))throw new Error('25MBを超える外部音声の自動分割は、現在M4A（.m4a）またはMP4（.mp4）に対応しています。');
  processingTitle.textContent='ボイスメモを分割しています';processingDetail.textContent='音声を壊さずに約10分ごとの区間へ分けています。';
  const {createFile}=await import('./vendor/mp4box.all.js');
  const source=await blob.arrayBuffer();source.fileStart=0;
  return new Promise((resolve,reject)=>{
    const mp4=createFile();let initBuffer=null;const parts=[];let settled=false;
    const fail=message=>{if(!settled){settled=true;reject(new Error(message))}};
    mp4.onError=error=>fail(`M4Aを解析できませんでした（${String(error)}）`);
    mp4.onSegment=(id,user,buffer,sampleNumber,last)=>{parts.push(new Blob([initBuffer.slice(0),buffer],{type:'audio/mp4'}));if(last&&!settled){settled=true;resolve(parts)}};
    mp4.onReady=info=>{
      const track=(info.audioTracks||[])[0]||info.tracks.find(item=>item.audio);
      if(!track){fail('音声トラックが見つかりませんでした');return}
      const durationSeconds=track.duration/track.timescale;
      const bitrate=track.bitrate||Math.max(1,blob.size*8/durationSeconds);
      const safeSeconds=Math.max(60,Math.min(600,Math.floor((20*1024*1024*8)/bitrate)));
      const samplesPerSecond=track.nb_samples/durationSeconds;
      mp4.setSegmentOptions(track.id,null,{nbSamples:Math.max(1,Math.floor(samplesPerSecond*safeSeconds)),rapAlignement:false,normalizeAudioSampleEntriesForMSE:true});
      const initialized=mp4.initializeSegmentation();initBuffer=initialized?.[0]?.buffer;
      if(!initBuffer){fail('音声の分割準備に失敗しました');return}
      mp4.start();
    };
    try{mp4.appendBuffer(source);mp4.flush()}catch(error){fail(error.message||'M4Aの分割に失敗しました')}
  });
}
async function prepareTranscriptionParts(){
  if(recordingSegments.length)return recordingSegments;
  if(currentBlob.size<=MAX_TRANSCRIPTION_BYTES)return[currentBlob];
  if(!selectedAudioFile)throw new Error('音声ファイルが25MBを超えています。');
  if(!externalTranscriptionParts.length)externalTranscriptionParts=await splitExternalMp4(currentBlob);
  const oversized=externalTranscriptionParts.find(part=>part.size>MAX_TRANSCRIPTION_BYTES);
  if(oversized)throw new Error('分割後も25MBを超える区間がありました。音声を短くしてお試しください。');
  return externalTranscriptionParts;
}
async function transcribeWithOpenAI(){
  if(!currentBlob)return;
  const endpoint=window.KOTONOHA_CONFIG?.transcribeApiUrl;
  showTranscript();
  if(!endpoint){setStatus('OpenAI文字起こしサーバーが設定されていません。');return}
  transcriptionError.classList.add('hidden');apiTranscribeButton.disabled=true;processingBox.classList.remove('hidden');setStatus('OpenAIで高精度に文字起こししています');
  try{const parts=await prepareTranscriptionParts();processingTitle.textContent='OpenAIが音声を文字起こししています';const results=[];for(let index=0;index<parts.length;index++){processingDetail.textContent=`${index+1} / ${parts.length}区間を処理中です。画面を閉じずにお待ちください。`;const form=new FormData(),name=`recording_${index+1}.${parts[index].type.includes('webm')?'webm':'m4a'}`;form.append('file',new File([parts[index]],name,{type:parts[index].type||'audio/mp4'}));form.append('language','ja');const context=referenceText.value.trim();if(context)form.append('reference_text',context.slice(0,20000));const response=await fetch(endpoint,{method:'POST',body:form});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${index+1}区間目: ${data.error||'OpenAI文字起こしに失敗しました'}`);results.push(data.text||'')}const completed=results.filter(Boolean).join('\n\n');if(!completed)throw new Error('文字起こし結果が空でした');transcriptText.value=completed;recognitionFinalText=completed;setStatus(`OpenAI文字起こしが完了しました（${parts.length}区間）`)}
  catch(error){transcriptionError.textContent=`OpenAI文字起こしに失敗しました：${error.message||'不明なエラー'}。iPhoneの文字起こし結果は変更していません。`;transcriptionError.classList.remove('hidden');setStatus('OpenAI文字起こしに失敗しました')}
  finally{processingBox.classList.add('hidden');apiTranscribeButton.disabled=false}
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
    const context=referenceText.value.trim();const references=context?[{name:'確認・編集済み参考資料テキスト',type:'text/plain',text:context.slice(0,120000)}]:[];
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript,references,metadata:{meeting_title:valueOf('meetingTitle'),date_time:valueOf('meetingDate'),place:valueOf('meetingPlace'),attendees:valueOf('meetingAttendees')}})});
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
micCheckButton.addEventListener('click',checkInputMicrophone);useInternalMicButton.addEventListener('click',()=>closeMicCheck('内蔵マイクを使用します'));
transcribeButton.addEventListener('click',showTranscript);apiTranscribeButton.addEventListener('click',transcribeWithOpenAI);copyButton.addEventListener('click',copyTranscript);downloadTextButton.addEventListener('click',downloadTranscript);
referenceFiles.addEventListener('change',addReferenceFiles);
createMinutesButton.addEventListener('click',createMinutes);regenerateButton.addEventListener('click',createMinutes);copyMinutesButton.addEventListener('click',copyMinutes);downloadMinutesButton.addEventListener('click',downloadMinutes);
downloadWordButton.addEventListener('click',downloadWord);
saveHistoryButton.addEventListener('click',saveToHistory);historySearch.addEventListener('input',renderHistory);renderHistory();
window.addEventListener('beforeunload',event=>{if(recorder&&recorder.state!=='inactive'){event.preventDefault();event.returnValue=''}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&recorder?.state==='recording')keepScreenAwake()});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
document.body.classList.add('mic-check-open');
