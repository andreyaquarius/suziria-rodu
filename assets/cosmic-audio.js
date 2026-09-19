(function(root){
  'use strict';
  // Original scores synthesized on the device. No recordings or network requests.
  const TRACKS=Object.freeze([
    {id:'cosmic',title:'Сузір’я',description:'Знайомий космічний фон: повільні акорди й легке відлуння.',interval:8,delay:.72,feedback:.28},
    {id:'memories',title:'Теплі спогади',description:'М’які клавіші та некваплива мелодія для занурення в історії.',interval:6.4,delay:.38,feedback:.18},
    {id:'starlight',title:'Зоряні дзвіночки',description:'Світлі дзвінкі ноти, що м’яко перегукуються між собою.',interval:7.2,delay:.9,feedback:.24},
    {id:'deep-space',title:'Глибокий космос',description:'Низький, протяжний ембієнт із мінімумом мелодії.',interval:12,delay:1.2,feedback:.3},
    {id:'strings',title:'Струни роду',description:'Тихі щипкові перебори з теплим, акустичним настроєм.',interval:5.4,delay:.27,feedback:.16},
  ].map(track=>Object.freeze(track)));
  const frequency=midi=>440*2**((midi-69)/12);
  class CosmicAudio {
    static get tracks(){return TRACKS;}
    constructor(){
      this.context=null;this.enabled=false;this.ducked=false;this.hidden=false;
      this.volume=.28;this.track='cosmic';this.timer=null;this.step=0;
      this.voices=new Set();this.pending=Promise.resolve();this.onChange=()=>{};
    }
    get score(){return TRACKS.find(track=>track.id===this.track);}
    async toggle(){
      this.enabled=!this.enabled;
      try{await this.sync();}catch(error){this.enabled=false;await this.sync();throw error;}
      return this.enabled;
    }
    setVolume(value){
      this.volume=Math.max(0,Math.min(1,Number(value)||0));
      if(this.gain)this.gain.gain.setTargetAtTime(this.volume*.17,this.context.currentTime,.15);
      this.onChange();
    }
    async setTrack(id){
      if(!TRACKS.some(track=>track.id===id)||id===this.track)return;
      this.track=id;this.step=0;this.clearPhrase(true);this.configureScore();
      await this.sync();
    }
    async setDucked(value){this.ducked=Boolean(value);await this.sync();}
    async setHidden(value){this.hidden=Boolean(value);await this.sync();}
    sync(){
      // Serialize resume/suspend: fast clicks or hiding a tab cannot leave sound on.
      this.pending=this.pending.catch(()=>{}).then(()=>this.syncNow());
      return this.pending;
    }
    configureScore(){
      if(!this.context)return;
      this.delay.delayTime.setTargetAtTime(this.score.delay,this.context.currentTime,.15);
      this.feedback.gain.setTargetAtTime(this.score.feedback,this.context.currentTime,.15);
    }
    async syncNow(){
      if(!this.enabled||this.ducked||this.hidden){
        this.clearPhrase();
        if(this.context?.state==='running')await this.context.suspend();
        this.onChange();return;
      }
      if(!this.context){
        const AudioContext=root.AudioContext||root.webkitAudioContext;
        if(!AudioContext)throw new Error('Audio unavailable');
        this.context=new AudioContext();this.gain=this.context.createGain();this.gain.gain.value=this.volume*.17;
        const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=4;
        this.gain.connect(compressor);compressor.connect(this.context.destination);
        this.delay=this.context.createDelay(3);this.feedback=this.context.createGain();
        this.delay.delayTime.value=this.score.delay;this.feedback.gain.value=this.score.feedback;
        this.delay.connect(this.feedback);this.feedback.connect(this.delay);this.delay.connect(this.gain);
        this.configureScore();
      }
      await this.context.resume();
      if(this.enabled&&!this.ducked&&!this.hidden&&!this.timer){
        this.phrase();this.timer=setInterval(()=>this.phrase(),this.score.interval*1000);
      }
      this.onChange();
    }
    clearPhrase(fade=false){
      clearInterval(this.timer);this.timer=null;
      const now=this.context?.currentTime||0;
      for(const voice of this.voices){
        try{
          if(fade&&this.context?.state==='running'){
            voice.envelope.gain.cancelScheduledValues(now);
            voice.envelope.gain.setTargetAtTime(.0001,now,.025);
            voice.oscillator.stop(now+.12);
          }else{
            voice.oscillator.stop();voice.oscillator.disconnect();voice.envelope.disconnect();
            this.voices.delete(voice);
          }
        }catch(_){this.voices.delete(voice);}
      }
    }
    tone(hz,start,length,level,type='sine',attack=Math.min(2,length/4)){
      const oscillator=this.context.createOscillator(),envelope=this.context.createGain();
      oscillator.type=type;oscillator.frequency.value=hz;
      envelope.gain.setValueAtTime(0,start);
      envelope.gain.linearRampToValueAtTime(level,start+attack);
      envelope.gain.exponentialRampToValueAtTime(.0001,start+length);
      oscillator.connect(envelope);envelope.connect(this.gain);envelope.connect(this.delay);
      const voice={oscillator,envelope};this.voices.add(voice);
      oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();this.voices.delete(voice);};
      oscillator.start(start);oscillator.stop(start+length+.05);
    }
    phrase(){
      if(!this.context||this.context.state!=='running'||!this.enabled||this.ducked||this.hidden)return;
      const step=this.step++,now=this.context.currentTime;
      const note=(midi,offset,length,level,type='sine',attack)=>this.tone(frequency(midi),now+offset,length,level,type,attack);
      if(this.track==='cosmic'){
        const chord=[[48,55,60],[45,52,59],[50,57,62],[43,50,55]][step%4];
        chord.forEach((n,i)=>note(n,i*.12,11,.1));
        [0,2,1,2].forEach((index,i)=>note(chord[index]+12,i*1.9,4,.09));
      }else if(this.track==='memories'){
        const chord=[[57,60,64,67],[53,57,60,65],[55,59,62,67],[52,55,59,64]][step%4];
        note(chord[0]-12,0,6.2,.12);
        [0,2,1,3,2,1].forEach((index,i)=>{
          note(chord[index],i*.95,3.8,.12,'triangle',.025);
          note(chord[index]+12,i*.95,1.8,.025,'sine',.015);
        });
      }else if(this.track==='starlight'){
        const chord=[[60,64,67,74],[57,60,64,71],[53,57,60,67],[55,59,62,69]][step%4];
        note(chord[0]-12,0,8,.09);
        [0,3,1,2,3].forEach((index,i)=>{
          note(chord[index]+12,i*1.35,4,.1,'sine',.015);
          note(chord[index]+24,i*1.35,2,.018,'sine',.008);
        });
      }else if(this.track==='deep-space'){
        const chord=[[36,43,50],[33,40,47],[38,45,52],[31,38,45]][step%4];
        chord.forEach((n,i)=>{
          note(n,i*.3,16,.105,'sine',3.5);
          this.tone(frequency(n)*1.002,now+i*.3,16,.035,'sine',3.5);
        });
        note(chord[2]+12,4,10,.04);
      }else if(this.track==='strings'){
        const chord=[[50,57,62,66],[47,54,59,62],[43,50,55,59],[45,52,57,61]][step%4];
        [0,1,2,3,2,1,3,2].forEach((index,i)=>{
          note(chord[index],i*.65,2.9,.11,'triangle',.012);
          note(chord[index]+12,i*.65,1.1,.026,'sine',.008);
        });
      }
    }
    async dispose(){
      this.enabled=false;await this.sync();
      const context=this.context;this.context=null;this.gain=null;this.delay=null;this.feedback=null;
      if(context)await context.close();this.onChange();
    }
  }
  class CosmicMusicControls {
    constructor(music,document,storage){
      this.music=music;this.busy=false;this.error=false;this.storage=storage;
      this.menu=document.getElementById('musicMenu');
      this.track=document.getElementById('musicTrack');
      this.toggle=document.getElementById('soundToggle');
      this.volume=document.getElementById('musicVolume');
      this.volumeValue=document.getElementById('musicVolumeValue');
      this.description=document.getElementById('musicDescription');
      this.status=document.getElementById('musicPlaybackStatus');
      this.indicator=document.getElementById('musicIndicator');
      try{
        const saved=JSON.parse(this.storage?.getItem('suziria-music')||'null');
        if(TRACKS.some(track=>track.id===saved?.track))music.track=saved.track;
        if(typeof saved?.volume==='number'&&Number.isFinite(saved.volume))music.setVolume(saved.volume);
      }catch(_){/* Storage can be disabled or contain an older preference. */}
      music.onChange=()=>this.render();
      this.toggle.addEventListener('click',()=>this.change(()=>music.toggle()));
      this.track.addEventListener('change',()=>{const id=this.track.value;return this.change(()=>music.setTrack(id));});
      this.volume.addEventListener('input',()=>{music.setVolume(Number(this.volume.value)/100);this.save();});
      document.addEventListener('click',event=>{if(!this.menu.contains(event.target))this.menu.open=false;});
      this.menu.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&this.menu.open){event.preventDefault();event.stopPropagation();this.menu.open=false;this.menu.querySelector('summary').focus();}
      });
      this.render();
    }
    save(){try{this.storage?.setItem('suziria-music',JSON.stringify({track:this.music.track,volume:this.music.volume}));}catch(_){}}
    async change(action){
      if(this.busy)return;
      this.busy=true;this.error=false;this.render();
      try{await action();this.save();}catch(_){this.error=true;}
      finally{this.busy=false;this.render();}
    }
    render(){
      const music=this.music;
      this.track.value=music.track;this.track.disabled=this.busy;
      this.description.textContent=music.score.description;
      this.volume.value=String(Math.round(music.volume*100));this.volumeValue.textContent=this.volume.value+'%';
      this.toggle.disabled=this.busy;this.toggle.setAttribute('aria-pressed',String(music.enabled));
      this.toggle.setAttribute('aria-label',music.enabled?'Вимкнути фонову музику':'Увімкнути фонову музику');
      this.toggle.textContent=music.enabled?'Ⅱ Вимкнути музику':'▶ Увімкнути музику';
      this.indicator.classList.toggle('playing',music.enabled&&!music.ducked&&!music.hidden);
      this.status.textContent=this.error?'Не вдалося ввімкнути звук. Спробуйте ще раз.':!music.enabled?'Звук вимкнено':music.ducked?'Пауза на час перегляду відео':music.hidden?'Пауза, поки вкладку приховано':'Грає: '+music.score.title;
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={CosmicAudio,CosmicMusicControls};
  else{root.CosmicAudio=CosmicAudio;root.CosmicMusicControls=CosmicMusicControls;}
})(globalThis);
