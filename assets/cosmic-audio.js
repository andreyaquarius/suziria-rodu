(function(root){
  'use strict';
  // Original ambient score, synthesized locally. No recordings or tracking requests.
  class CosmicAudio {
    constructor(){this.context=null;this.enabled=false;this.ducked=false;this.hidden=false;this.volume=.28;this.timer=null;this.step=0;}
    async toggle(){this.enabled=!this.enabled;try{await this.sync();}catch(error){this.enabled=false;throw error;}return this.enabled;}
    setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.gain)this.gain.gain.setTargetAtTime(this.volume*.17,this.context.currentTime,.4);}
    async setDucked(value){this.ducked=value;await this.sync();}
    async setHidden(value){this.hidden=value;await this.sync();}
    async sync(){
      const active=this.enabled&&!this.ducked&&!this.hidden;
      if(!active){clearInterval(this.timer);this.timer=null;if(this.context?.state==='running')await this.context.suspend();return;}
      if(!this.context){
        const AudioContext=root.AudioContext||root.webkitAudioContext;if(!AudioContext)throw new Error('Audio unavailable');
        this.context=new AudioContext();this.gain=this.context.createGain();this.gain.gain.value=this.volume*.17;
        const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=4;
        this.gain.connect(compressor);compressor.connect(this.context.destination);
        this.delay=this.context.createDelay(3);this.delay.delayTime.value=.72;
        const feedback=this.context.createGain();feedback.gain.value=.28;this.delay.connect(feedback);feedback.connect(this.delay);this.delay.connect(this.gain);
      }
      await this.context.resume();if(!this.timer){this.phrase();this.timer=setInterval(()=>this.phrase(),8000);}
    }
    tone(frequency,start,length,level,type='sine'){
      const oscillator=this.context.createOscillator(), envelope=this.context.createGain();oscillator.type=type;oscillator.frequency.value=frequency;
      envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(level,start+Math.min(2,length/4));envelope.gain.exponentialRampToValueAtTime(.0001,start+length);
      oscillator.connect(envelope);envelope.connect(this.gain);envelope.connect(this.delay);oscillator.start(start);oscillator.stop(start+length+.05);
      oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
    }
    phrase(){
      if(!this.context||this.context.state!=='running')return;
      const chords=[[130.81,196,261.63],[110,164.81,246.94],[146.83,220,293.66],[98,146.83,196]], chord=chords[this.step++%chords.length], now=this.context.currentTime;
      chord.forEach((f,i)=>this.tone(f,now+i*.12,11,.1));
      [0,2,1,2].forEach((index,i)=>this.tone(chord[index]*2,now+i*1.9,4,.09));
    }
    async dispose(){clearInterval(this.timer);this.timer=null;this.enabled=false;const context=this.context;this.context=null;this.gain=null;this.delay=null;if(context)await context.close();}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={CosmicAudio};else root.CosmicAudio=CosmicAudio;
})(globalThis);
