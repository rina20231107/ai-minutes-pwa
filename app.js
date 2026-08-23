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

let recorder=null,stream=null,chunks=[],elapsed=0,timerId=null,currentBlob=null,currentUrl=null,isPaused=false,wakeLock=null;
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
recordButton.addEventListener('click',startRecording);pauseButton.addEventListener('click',pauseOrResume);stopButton.addEventListener('click',stopRecording);shareButton.addEventListener('click',shareAudio);
window.addEventListener('beforeunload',event=>{if(recorder&&recorder.state!=='inactive'){event.preventDefault();event.returnValue=''}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&recorder?.state==='recording')keepScreenAwake()});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
