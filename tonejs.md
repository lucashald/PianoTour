Tone.Envelope
↳ EXTENDS Tone.AudioNode
Tone.Envelope is an ADSR envelope generator. Tone.Envelope outputs a signal which can be connected to an AudioParam or Tone.Signal.

CONSTRUCTOR
new Tone.Envelope ( [ attack ] , [ decay ] , [ sustain ] , [ release ] )
attack	
The amount of time it takes for the envelope to go from 0 to it’s maximum value.

type: Time
optional
decay	
The period of time after the attack that it takes for the envelope to fall to the sustain value.

type: Time
optional
sustain	
The percent of the maximum value that the envelope rests at until the release is triggered.

type: NormalRange
optional
release	
The amount of time after the release is triggered it takes to reach 0.

type: Time
optional
DEFAULTS
{
attack : 0.01 ,
decay : 0.1 ,
sustain : 0.5 ,
release : 1 ,
attackCurve : linear ,
releaseCurve : exponential
}
EXAMPLE
//an amplitude envelope
var gainNode = Tone.context.createGain();
var env = new Tone.Envelope({
	"attack" : 0.1,
	"decay" : 0.2,
	"sustain" : 1,
	"release" : 0.8,
});
env.connect(gainNode.gain);
MEMBERS
value
attackCurve
attack
decay
release
releaseCurve
sustain
context
METHODS
cancel
triggerAttackRelease
triggerRelease
dispose
getValueAtTime
triggerAttack
disconnect
toMaster
Members
.value ↝ Number READONLY #
Read the current value of the envelope. Useful for syncronizing visual output to the envelope.

</>
.attackCurve ↝ String or Array #
The shape of the attack. Can be any of these strings: <ul> <li>linear</li> <li>exponential</li> <li>sine</li> <li>cosine</li> <li>bounce</li> <li>ripple</li> <li>step</li> </ul> Can also be an array which describes the curve. Values in the array are evenly subdivided and linearly interpolated over the duration of the attack.

EXAMPLE
env.attackCurve = "linear";
EXAMPLE
//can also be an array
env.attackCurve = [0, 0.2, 0.3, 0.4, 1]
</>
.attack ↝ Time #
When triggerAttack is called, the attack time is the amount of time it takes for the envelope to reach it’s maximum value.

</>
.decay ↝ Time #
After the attack portion of the envelope, the value will fall over the duration of the decay time to it’s sustain value.

</>
.release ↝ Time #
After triggerRelease is called, the envelope’s value will fall to it’s miminum value over the duration of the release time.

</>
.releaseCurve ↝ String or Array #
The shape of the release. See the attack curve types.

EXAMPLE
env.releaseCurve = "linear";
</>
.sustain ↝ NormalRange #
The sustain value is the value which the envelope rests at after triggerAttack is called, but before triggerRelease is invoked.

</>
↳inherited from Tone.AudioNode
.context ↝ Tone.Context READONLY #
Get the audio context belonging to this instance.

</>
Methods
.cancel ( ) #
after	
type: Time
↪ returns Tone.Envelope	
this

Cancels all scheduled envelope changes after the given time.

</>
.triggerAttackRelease ( ) #
duration	
The duration of the sustain.

type: Time
time	
When the attack should be triggered.

type: Time
default: now
velocity	
The velocity of the envelope.

type: number
default: 1
↪ returns Tone.Envelope	
this

triggerAttackRelease is shorthand for triggerAttack, then waiting some duration, then triggerRelease.

EXAMPLE
//trigger the attack and then the release after 0.6 seconds.
env.triggerAttackRelease(0.6);
</>
.triggerRelease ( ) #
time	
When the release portion of the envelope should start.

type: Time
default: now
↪ returns Tone.Envelope	
this

Triggers the release of the envelope.

EXAMPLE
//trigger release immediately
 env.triggerRelease();
</>
.dispose ( ) #
↪ returns Tone.Envelope	
this

Disconnect and dispose.

</>
.getValueAtTime ( ) #
time	
The time in seconds.

type: Number
↪ returns Number	
The scheduled value at the given time.

Get the scheduled value at the given time. This will return the unconverted (raw) value.

</>
.triggerAttack ( ) #
time	
When the attack should start.

type: Time
default: now
velocity	
The velocity of the envelope scales the vales. number between 0-1

type: NormalRange
default: 1
↪ returns Tone.Envelope	
this

Trigger the attack/decay portion of the ADSR envelope.

EXAMPLE
//trigger the attack 0.5 seconds from now with a velocity of 0.2
 env.triggerAttack("+0.5", 0.2);
</>
↳inherited from Tone.AudioNode
.disconnect ( ) #
output	
Either the output index to disconnect if the output is an array, or the node to disconnect from.

type: Number or AudioNode
↪ returns Tone.AudioNode	
this

disconnect the output

</>
↳inherited from Tone.AudioNode
.toMaster ( ) #
↪ returns Tone.AudioNode	
this

Connect ‘this’ to the master output. Shorthand for this.connect(Tone.Master)

EXAMPLE
//connect an oscillator to the master output
var osc = new Tone.Oscillator().toMaster();

Class AmplitudeEnvelope
AmplitudeEnvelope is a Tone.Envelope connected to a gain node. Unlike Tone.Envelope, which outputs the envelope's value, AmplitudeEnvelope accepts an audio signal as the input and will apply the envelope to the amplitude of the signal. Read more about ADSR Envelopes on Wikipedia.

Example
return Tone.Offline(() => {
    const ampEnv = new Tone.AmplitudeEnvelope({
        attack: 0.1,
        decay: 0.2,
        sustain: 1.0,
        release: 0.8
    }).toDestination();
    // create an oscillator and connect it
    const osc = new Tone.Oscillator().connect(ampEnv).start();
    // trigger the envelopes attack and release "8t" apart
    ampEnv.triggerAttackRelease("8t");
}, 1.5, 1);
Copy
Hierarchy (view full)
Envelope
AmplitudeEnvelope
Defined in Tone/component/envelope/AmplitudeEnvelope.ts:28
Constructors
constructor
Properties
attack
context
debug
decay
input
name
output
release
sustain
version
Accessors
attackCurve
blockTime
channelCount
channelCountMode
channelInterpretation
decayCurve
disposed
numberOfInputs
numberOfOutputs
releaseCurve
sampleTime
value
Methods
asArray
cancel
chain
connect
disconnect
dispose
fan
get
getValueAtTime
immediate
now
set
toDestination
toFrequency
toMaster
toSeconds
toString
toTicks
triggerAttack
triggerAttackRelease
triggerRelease
getDefaults
Constructors
constructor
new AmplitudeEnvelope(attack?, decay?, sustain?, release?): AmplitudeEnvelope
Parameters
Optional attack: Unit.Time
The amount of time it takes for the envelope to go from 0 to it's maximum value.

Optional decay: Unit.Time
The period of time after the attack that it takes for the envelope to fall to the sustain value. Value must be greater than 0.

Optional sustain: number
The percent of the maximum value that the envelope rests at until the release is triggered.

Optional release: Unit.Time
The amount of time after the release is triggered it takes to reach 0. Value must be greater than 0.

Returns AmplitudeEnvelope
Overrides Envelope.constructor

Defined in Tone/component/envelope/AmplitudeEnvelope.ts:47
new AmplitudeEnvelope(options?): AmplitudeEnvelope
Parameters
Optional options: Partial<EnvelopeOptions>
Returns AmplitudeEnvelope
Overrides Envelope.constructor

Defined in Tone/component/envelope/AmplitudeEnvelope.ts:53
Properties
attack
attack: Unit.Time
When triggerAttack is called, the attack time is the amount of time it takes for the envelope to reach it's maximum value.

          /\
         /X \
        /XX  \
       /XXX   \
      /XXXX    \___________
     /XXXXX                \
    /XXXXXX                 \
   /XXXXXXX                  \
  /XXXXXXXX                   \
Copy
Min
0

Max
2

Inherited from Envelope.attack

Defined in Tone/component/envelope/Envelope.ts:76
Readonly
context
context: BaseContext
The context belonging to the node.

Inherited from Envelope.context

Defined in Tone/core/context/ToneWithContext.ts:40
debug
debug: boolean = false
Set this debug flag to log all events that happen in this class.

Inherited from Envelope.debug

Defined in Tone/core/Tone.ts:49
decay
decay: Unit.Time
After the attack portion of the envelope, the value will fall over the duration of the decay time to it's sustain value.

          /\
         / X\
        /  XX\
       /   XXX\
      /    XXXX\___________
     /     XXXXX           \
    /      XXXXX            \
   /       XXXXX             \
  /        XXXXX              \
Copy
Min
0

Max
2

Inherited from Envelope.decay

Defined in Tone/component/envelope/Envelope.ts:96
input
input: Gain<"gain"> = ...
Envelope has no input

Overrides Envelope.input

Defined in Tone/component/envelope/AmplitudeEnvelope.ts:36
Readonly
name
name: string = "AmplitudeEnvelope"
The name of the class

Overrides Envelope.name

Defined in Tone/component/envelope/AmplitudeEnvelope.ts:29
output
output: Gain<"gain"> = ...
The output signal of the envelope

Overrides Envelope.output

Defined in Tone/component/envelope/AmplitudeEnvelope.ts:35
release
release: Unit.Time
After triggerRelease is called, the envelope's value will fall to it's miminum value over the duration of the release time.

          /\
         /  \
        /    \
       /      \
      /        \___________
     /                    X\
    /                     XX\
   /                      XXX\
  /                       XXXX\
Copy
Min
0

Max
5

Inherited from Envelope.release

Defined in Tone/component/envelope/Envelope.ts:136
sustain
sustain: number
The sustain value is the value which the envelope rests at after triggerAttack is called, but before triggerRelease is invoked.

          /\
         /  \
        /    \
       /      \
      /        \___________
     /          XXXXXXXXXXX\
    /           XXXXXXXXXXX \
   /            XXXXXXXXXXX  \
  /             XXXXXXXXXXX   \
Copy
Inherited from Envelope.sustain

Defined in Tone/component/envelope/Envelope.ts:115
Static
version
version: string = version
The version number semver

Inherited from Envelope.version

Defined in Tone/core/Tone.ts:28
Accessors
attackCurve
get attackCurve(): EnvelopeCurve
The shape of the attack. Can be any of these strings:

"linear"
"exponential"
"sine"
"cosine"
"bounce"
"ripple"
"step"
Can also be an array which describes the curve. Values in the array are evenly subdivided and linearly interpolated over the duration of the attack.

Returns EnvelopeCurve
Example
return Tone.Offline(() => {
    const env = new Tone.Envelope(0.4).toDestination();
    env.attackCurve = "linear";
    env.triggerAttack();
}, 1, 1);
Copy
Inherited from Envelope.attackCurve

Defined in Tone/component/envelope/Envelope.ts:299
set attackCurve(curve): void
Parameters
curve: EnvelopeCurve
Returns void
Inherited from Envelope.attackCurve

Defined in Tone/component/envelope/Envelope.ts:302
blockTime
get blockTime(): number
The number of seconds of 1 processing block (128 samples)

Returns number
Example
console.log(Tone.Destination.blockTime);
Copy
Inherited from Envelope.blockTime

Defined in Tone/core/context/ToneWithContext.ts:108
channelCount
get channelCount(): number
channelCount is the number of channels used when up-mixing and down-mixing connections to any inputs to the node. The default value is 2 except for specific nodes where its value is specially determined.

Returns number
Inherited from Envelope.channelCount

Defined in Tone/core/context/ToneAudioNode.ts:153
set channelCount(channelCount): void
Parameters
channelCount: number
Returns void
Inherited from Envelope.channelCount

Defined in Tone/core/context/ToneAudioNode.ts:156
channelCountMode
get channelCountMode(): ChannelCountMode
channelCountMode determines how channels will be counted when up-mixing and down-mixing connections to any inputs to the node. The default value is "max". This attribute has no effect for nodes with no inputs.

"max" - computedNumberOfChannels is the maximum of the number of channels of all connections to an input. In this mode channelCount is ignored.
"clamped-max" - computedNumberOfChannels is determined as for "max" and then clamped to a maximum value of the given channelCount.
"explicit" - computedNumberOfChannels is the exact value as specified by the channelCount.
Returns ChannelCountMode
Inherited from Envelope.channelCountMode

Defined in Tone/core/context/ToneAudioNode.ts:170
set channelCountMode(channelCountMode): void
Parameters
channelCountMode: ChannelCountMode
Returns void
Inherited from Envelope.channelCountMode

Defined in Tone/core/context/ToneAudioNode.ts:173
channelInterpretation
get channelInterpretation(): ChannelInterpretation
channelInterpretation determines how individual channels will be treated when up-mixing and down-mixing connections to any inputs to the node. The default value is "speakers".

Returns ChannelInterpretation
Inherited from Envelope.channelInterpretation

Defined in Tone/core/context/ToneAudioNode.ts:184
set channelInterpretation(channelInterpretation): void
Parameters
channelInterpretation: ChannelInterpretation
Returns void
Inherited from Envelope.channelInterpretation

Defined in Tone/core/context/ToneAudioNode.ts:187
decayCurve
get decayCurve(): EnvelopeCurve
The shape of the decay either "linear" or "exponential"

Returns EnvelopeCurve
Example
return Tone.Offline(() => {
    const env = new Tone.Envelope({
        sustain: 0.1,
        decay: 0.5
    }).toDestination();
    env.decayCurve = "linear";
    env.triggerAttack();
}, 1, 1);
Copy
Inherited from Envelope.decayCurve

Defined in Tone/component/envelope/Envelope.ts:338
set decayCurve(curve): void
Parameters
curve: EnvelopeCurve
Returns void
Inherited from Envelope.decayCurve

Defined in Tone/component/envelope/Envelope.ts:341
disposed
get disposed(): boolean
Indicates if the instance was disposed. 'Disposing' an instance means that all of the Web Audio nodes that were created for the instance are disconnected and freed for garbage collection.

Returns boolean
Inherited from Envelope.disposed

Defined in Tone/core/Tone.ts:96
numberOfInputs
get numberOfInputs(): number
The number of inputs feeding into the AudioNode. For source nodes, this will be 0.

Returns number
Example
const node = new Tone.Gain();
console.log(node.numberOfInputs);
Copy
Inherited from Envelope.numberOfInputs

Defined in Tone/core/context/ToneAudioNode.ts:52
numberOfOutputs
get numberOfOutputs(): number
The number of outputs of the AudioNode.

Returns number
Example
const node = new Tone.Gain();
console.log(node.numberOfOutputs);
Copy
Inherited from Envelope.numberOfOutputs

Defined in Tone/core/context/ToneAudioNode.ts:70
releaseCurve
get releaseCurve(): EnvelopeCurve
The shape of the release. See the attack curve types.

Returns EnvelopeCurve
Example
return Tone.Offline(() => {
    const env = new Tone.Envelope({
        release: 0.8
    }).toDestination();
    env.triggerAttack();
    // release curve could also be defined by an array
    env.releaseCurve = [1, 0.3, 0.4, 0.2, 0.7, 0];
    env.triggerRelease(0.2);
}, 1, 1);
Copy
Inherited from Envelope.releaseCurve

Defined in Tone/component/envelope/Envelope.ts:319
set releaseCurve(curve): void
Parameters
curve: EnvelopeCurve
Returns void
Inherited from Envelope.releaseCurve

Defined in Tone/component/envelope/Envelope.ts:322
sampleTime
get sampleTime(): number
The duration in seconds of one sample.

Returns number
Inherited from Envelope.sampleTime

Defined in Tone/core/context/ToneWithContext.ts:99
value
get value(): number
Read the current value of the envelope. Useful for synchronizing visual output to the envelope.

Returns number
Inherited from Envelope.value

Defined in Tone/component/envelope/Envelope.ts:221
Methods
asArray
asArray(length?): Promise<Float32Array>
Render the envelope curve to an array of the given length. Good for visualizing the envelope curve. Rescales the duration of the envelope to fit the length.

Parameters
length: number = 1024
Returns Promise<Float32Array>
Inherited from Envelope.asArray

Defined in Tone/component/envelope/Envelope.ts:513
cancel
cancel(after?): this
Cancels all scheduled envelope changes after the given time.

Parameters
Optional after: Unit.Time
Returns this
Inherited from Envelope.cancel

Defined in Tone/component/envelope/Envelope.ts:495
chain
chain(...nodes): this
Connect the output of this node to the rest of the nodes in series.

Parameters
Rest ...nodes: InputNode[]
Returns this
Example
const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/handdrum-loop.mp3");
player.autostart = true;
const filter = new Tone.AutoFilter(4).start();
const distortion = new Tone.Distortion(0.5);
// connect the player to the filter, distortion and then to the master output
player.chain(filter, distortion, Tone.Destination);
Copy
Inherited from Envelope.chain

Defined in Tone/core/context/ToneAudioNode.ts:249
connect
connect(destination, outputNumber?, inputNumber?): this
Connect the envelope to a destination node.

Parameters
destination: InputNode
outputNumber: number = 0
inputNumber: number = 0
Returns this
Inherited from Envelope.connect

Defined in Tone/component/envelope/Envelope.ts:503
disconnect
disconnect(destination?, outputNum?, inputNum?): this
disconnect the output

Parameters
Optional destination: InputNode
outputNum: number = 0
inputNum: number = 0
Returns this
Inherited from Envelope.disconnect

Defined in Tone/core/context/ToneAudioNode.ts:234
dispose
dispose(): this
Clean up

Returns this
Overrides Envelope.dispose

Defined in Tone/component/envelope/AmplitudeEnvelope.ts:71
fan
fan(...nodes): this
connect the output of this node to the rest of the nodes in parallel.

Parameters
Rest ...nodes: InputNode[]
Returns this
Example
const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/conga-rhythm.mp3");
player.autostart = true;
const pitchShift = new Tone.PitchShift(4).toDestination();
const filter = new Tone.Filter("G5").toDestination();
// connect a node to the pitch shift and filter in parallel
player.fan(pitchShift, filter);
Copy
Inherited from Envelope.fan

Defined in Tone/core/context/ToneAudioNode.ts:264
get
get(): EnvelopeOptions
Get the object's attributes.

Returns EnvelopeOptions
Example
const osc = new Tone.Oscillator();
console.log(osc.get());
Copy
Inherited from Envelope.get

Defined in Tone/core/context/ToneWithContext.ts:170
getValueAtTime
getValueAtTime(time): number
Get the scheduled value at the given time. This will return the unconverted (raw) value.

Parameters
time: Unit.Time
Returns number
Example
const env = new Tone.Envelope(0.5, 1, 0.4, 2);
env.triggerAttackRelease(2);
setInterval(() => console.log(env.getValueAtTime(Tone.now())), 100);
Copy
Inherited from Envelope.getValueAtTime

Defined in Tone/component/envelope/Envelope.ts:465
immediate
immediate(): number
Return the current time of the Context clock without any lookAhead.

Returns number
Example
setInterval(() => {
    console.log(Tone.immediate());
}, 100);
Copy
Inherited from Envelope.immediate

Defined in Tone/core/context/ToneWithContext.ts:92
now
now(): number
Return the current time of the Context clock plus the lookAhead.

Returns number
Example
setInterval(() => {
    console.log(Tone.now());
}, 100);
Copy
Inherited from Envelope.now

Defined in Tone/core/context/ToneWithContext.ts:81
set
set(props): this
Set multiple properties at once with an object.

Parameters
props: RecursivePartial<EnvelopeOptions>
Returns this
Example
const filter = new Tone.Filter().toDestination();
// set values using an object
filter.set({
    frequency: "C6",
    type: "highpass"
});
const player = new Tone.Player("https://tonejs.github.io/audio/berklee/Analogsynth_octaves_highmid.mp3").connect(filter);
player.autostart = true;
Copy
Inherited from Envelope.set

Defined in Tone/core/context/ToneWithContext.ts:215
toDestination
toDestination(): this
Connect the output to the context's destination node.

Returns this
Example
const osc = new Tone.Oscillator("C2").start();
osc.toDestination();
Copy
Inherited from Envelope.toDestination

Defined in Tone/core/context/ToneAudioNode.ts:216
toFrequency
toFrequency(freq): number
Convert the input to a frequency number

Parameters
freq: Unit.Frequency
Returns number
Example
const gain = new Tone.Gain();
console.log(gain.toFrequency("4n"));
Copy
Inherited from Envelope.toFrequency

Defined in Tone/core/context/ToneWithContext.ts:132
toMaster
toMaster(): this
Connect the output to the context's destination node.

Returns this
See
toDestination

Deprecated
Inherited from Envelope.toMaster

Defined in Tone/core/context/ToneAudioNode.ts:226
toSeconds
toSeconds(time?): number
Convert the incoming time to seconds. This is calculated against the current TransportClass bpm

Parameters
Optional time: Unit.Time
Returns number
Example
const gain = new Tone.Gain();
setInterval(() => console.log(gain.toSeconds("4n")), 100);
// ramp the tempo to 60 bpm over 30 seconds
Tone.getTransport().bpm.rampTo(60, 30);
Copy
Inherited from Envelope.toSeconds

Defined in Tone/core/context/ToneWithContext.ts:121
toString
toString(): string
Convert the class to a string

Returns string
Example
const osc = new Tone.Oscillator();
console.log(osc.toString());
Copy
Inherited from Envelope.toString

Defined in Tone/core/Tone.ts:106
toTicks
toTicks(time?): number
Convert the input time into ticks

Parameters
Optional time: Unit.Time | TimeClass<number, TimeBaseUnit>
Returns number
Example
const gain = new Tone.Gain();
console.log(gain.toTicks("4n"));
Copy
Inherited from Envelope.toTicks

Defined in Tone/core/context/ToneWithContext.ts:142
triggerAttack
triggerAttack(time?, velocity?): this
Trigger the attack/decay portion of the ADSR envelope.

Parameters
Optional time: Unit.Time
When the attack should start.

velocity: number = 1
The velocity of the envelope scales the vales. number between 0-1

Returns this
Example
const env = new Tone.AmplitudeEnvelope().toDestination();
const osc = new Tone.Oscillator().connect(env).start();
// trigger the attack 0.5 seconds from now with a velocity of 0.2
env.triggerAttack("+0.5", 0.2);
Copy
Inherited from Envelope.triggerAttack

Defined in Tone/component/envelope/Envelope.ts:356
triggerAttackRelease
triggerAttackRelease(duration, time?, velocity?): this
triggerAttackRelease is shorthand for triggerAttack, then waiting some duration, then triggerRelease.

Parameters
duration: Unit.Time
The duration of the sustain.

Optional time: Unit.Time
When the attack should be triggered.

velocity: number = 1
The velocity of the envelope.

Returns this
Example
const env = new Tone.AmplitudeEnvelope().toDestination();
const osc = new Tone.Oscillator().connect(env).start();
// trigger the release 0.5 seconds after the attack
env.triggerAttackRelease(0.5);
Copy
Inherited from Envelope.triggerAttackRelease

Defined in Tone/component/envelope/Envelope.ts:481
triggerRelease
triggerRelease(time?): this
Triggers the release of the envelope.

Parameters
Optional time: Unit.Time
When the release portion of the envelope should start.

Returns this
Example
const env = new Tone.AmplitudeEnvelope().toDestination();
const osc = new Tone.Oscillator({
    type: "sawtooth"
}).connect(env).start();
env.triggerAttack();
// trigger the release half a second after the attack
env.triggerRelease("+0.5");
Copy
Inherited from Envelope.triggerRelease

Defined in Tone/component/envelope/Envelope.ts:428
Static
getDefaults
getDefaults(): EnvelopeOptions
Returns EnvelopeOptions
Inherited from Envelope.getDefaults

Defined in Tone/component/envelope/Envelope.ts:205

Class Envelope
Envelope is an ADSR envelope generator. Envelope outputs a signal which can be connected to an AudioParam or Tone.Signal.

          /\
         /  \
        /    \
       /      \
      /        \___________
     /                     \
    /                       \
   /                         \
  /                           \
Copy
Example
return Tone.Offline(() => {
    const env = new Tone.Envelope({
        attack: 0.1,
        decay: 0.2,
        sustain: 0.5,
        release: 0.8,
    }).toDestination();
    env.triggerAttackRelease(0.5);
}, 1.5, 1);
Copy
Hierarchy (view full)
ToneAudioNode<EnvelopeOptions>
Envelope
AmplitudeEnvelope
FrequencyEnvelope
Defined in Tone/component/envelope/Envelope.ts:55
Constructors
constructor
Properties
attack
context
debug
decay
input
name
output
release
sustain
version
Accessors
attackCurve
blockTime
channelCount
channelCountMode
channelInterpretation
decayCurve
disposed
numberOfInputs
numberOfOutputs
releaseCurve
sampleTime
value
Methods
asArray
cancel
chain
connect
disconnect
dispose
fan
get
getValueAtTime
immediate
now
set
toDestination
toFrequency
toMaster
toSeconds
toString
toTicks
triggerAttack
triggerAttackRelease
triggerRelease
getDefaults
Constructors
constructor
new Envelope(attack?, decay?, sustain?, release?): Envelope
Parameters
Optional attack: Unit.Time
The amount of time it takes for the envelope to go from 0 to it's maximum value.

Optional decay: Unit.Time
The period of time after the attack that it takes for the envelope to fall to the sustain value. Value must be greater than 0.

Optional sustain: number
The percent of the maximum value that the envelope rests at until the release is triggered.

Optional release: Unit.Time
The amount of time after the release is triggered it takes to reach 0. Value must be greater than 0.

Returns Envelope
Overrides ToneAudioNode.constructor

Defined in Tone/component/envelope/Envelope.ts:181
new Envelope(options?): Envelope
Parameters
Optional options: Partial<EnvelopeOptions>
Returns Envelope
Overrides ToneAudioNode.constructor

Defined in Tone/component/envelope/Envelope.ts:187
Properties
attack
attack: Unit.Time
When triggerAttack is called, the attack time is the amount of time it takes for the envelope to reach it's maximum value.

          /\
         /X \
        /XX  \
       /XXX   \
      /XXXX    \___________
     /XXXXX                \
    /XXXXXX                 \
   /XXXXXXX                  \
  /XXXXXXXX                   \
Copy
Min
0

Max
2

Defined in Tone/component/envelope/Envelope.ts:76
Readonly
context
context: BaseContext
The context belonging to the node.

Inherited from ToneAudioNode.context

Defined in Tone/core/context/ToneWithContext.ts:40
debug
debug: boolean = false
Set this debug flag to log all events that happen in this class.

Inherited from ToneAudioNode.debug

Defined in Tone/core/Tone.ts:49
decay
decay: Unit.Time
After the attack portion of the envelope, the value will fall over the duration of the decay time to it's sustain value.

          /\
         / X\
        /  XX\
       /   XXX\
      /    XXXX\___________
     /     XXXXX           \
    /      XXXXX            \
   /       XXXXX             \
  /        XXXXX              \
Copy
Min
0

Max
2

Defined in Tone/component/envelope/Envelope.ts:96
input
input: undefined | InputNode = undefined
Envelope has no input

Overrides ToneAudioNode.input

Defined in Tone/component/envelope/Envelope.ts:169
Readonly
name
name: string = "Envelope"
The name of the class

Overrides ToneAudioNode.name

Defined in Tone/component/envelope/Envelope.ts:56
output
output: OutputNode = ...
The output signal of the envelope

Overrides ToneAudioNode.output

Defined in Tone/component/envelope/Envelope.ts:164
release
release: Unit.Time
After triggerRelease is called, the envelope's value will fall to it's miminum value over the duration of the release time.

          /\
         /  \
        /    \
       /      \
      /        \___________
     /                    X\
    /                     XX\
   /                      XXX\
  /                       XXXX\
Copy
Min
0

Max
5

Defined in Tone/component/envelope/Envelope.ts:136
sustain
sustain: number
The sustain value is the value which the envelope rests at after triggerAttack is called, but before triggerRelease is invoked.

          /\
         /  \
        /    \
       /      \
      /        \___________
     /          XXXXXXXXXXX\
    /           XXXXXXXXXXX \
   /            XXXXXXXXXXX  \
  /             XXXXXXXXXXX   \
Copy
Defined in Tone/component/envelope/Envelope.ts:115
Static
version
version: string = version
The version number semver

Inherited from ToneAudioNode.version

Defined in Tone/core/Tone.ts:28
Accessors
attackCurve
get attackCurve(): EnvelopeCurve
The shape of the attack. Can be any of these strings:

"linear"
"exponential"
"sine"
"cosine"
"bounce"
"ripple"
"step"
Can also be an array which describes the curve. Values in the array are evenly subdivided and linearly interpolated over the duration of the attack.

Returns EnvelopeCurve
Example
return Tone.Offline(() => {
    const env = new Tone.Envelope(0.4).toDestination();
    env.attackCurve = "linear";
    env.triggerAttack();
}, 1, 1);
Copy
Defined in Tone/component/envelope/Envelope.ts:299
set attackCurve(curve): void
Parameters
curve: EnvelopeCurve
Returns void
Defined in Tone/component/envelope/Envelope.ts:302
blockTime
get blockTime(): number
The number of seconds of 1 processing block (128 samples)

Returns number
Example
console.log(Tone.Destination.blockTime);
Copy
Inherited from ToneAudioNode.blockTime

Defined in Tone/core/context/ToneWithContext.ts:108
channelCount
get channelCount(): number
channelCount is the number of channels used when up-mixing and down-mixing connections to any inputs to the node. The default value is 2 except for specific nodes where its value is specially determined.

Returns number
Inherited from ToneAudioNode.channelCount

Defined in Tone/core/context/ToneAudioNode.ts:153
set channelCount(channelCount): void
Parameters
channelCount: number
Returns void
Inherited from ToneAudioNode.channelCount

Defined in Tone/core/context/ToneAudioNode.ts:156
channelCountMode
get channelCountMode(): ChannelCountMode
channelCountMode determines how channels will be counted when up-mixing and down-mixing connections to any inputs to the node. The default value is "max". This attribute has no effect for nodes with no inputs.

"max" - computedNumberOfChannels is the maximum of the number of channels of all connections to an input. In this mode channelCount is ignored.
"clamped-max" - computedNumberOfChannels is determined as for "max" and then clamped to a maximum value of the given channelCount.
"explicit" - computedNumberOfChannels is the exact value as specified by the channelCount.
Returns ChannelCountMode
Inherited from ToneAudioNode.channelCountMode

Defined in Tone/core/context/ToneAudioNode.ts:170
set channelCountMode(channelCountMode): void
Parameters
channelCountMode: ChannelCountMode
Returns void
Inherited from ToneAudioNode.channelCountMode

Defined in Tone/core/context/ToneAudioNode.ts:173
channelInterpretation
get channelInterpretation(): ChannelInterpretation
channelInterpretation determines how individual channels will be treated when up-mixing and down-mixing connections to any inputs to the node. The default value is "speakers".

Returns ChannelInterpretation
Inherited from ToneAudioNode.channelInterpretation

Defined in Tone/core/context/ToneAudioNode.ts:184
set channelInterpretation(channelInterpretation): void
Parameters
channelInterpretation: ChannelInterpretation
Returns void
Inherited from ToneAudioNode.channelInterpretation

Defined in Tone/core/context/ToneAudioNode.ts:187
decayCurve
get decayCurve(): EnvelopeCurve
The shape of the decay either "linear" or "exponential"

Returns EnvelopeCurve
Example
return Tone.Offline(() => {
    const env = new Tone.Envelope({
        sustain: 0.1,
        decay: 0.5
    }).toDestination();
    env.decayCurve = "linear";
    env.triggerAttack();
}, 1, 1);
Copy
Defined in Tone/component/envelope/Envelope.ts:338
set decayCurve(curve): void
Parameters
curve: EnvelopeCurve
Returns void
Defined in Tone/component/envelope/Envelope.ts:341
disposed
get disposed(): boolean
Indicates if the instance was disposed. 'Disposing' an instance means that all of the Web Audio nodes that were created for the instance are disconnected and freed for garbage collection.

Returns boolean
Inherited from ToneAudioNode.disposed

Defined in Tone/core/Tone.ts:96
numberOfInputs
get numberOfInputs(): number
The number of inputs feeding into the AudioNode. For source nodes, this will be 0.

Returns number
Example
const node = new Tone.Gain();
console.log(node.numberOfInputs);
Copy
Inherited from ToneAudioNode.numberOfInputs

Defined in Tone/core/context/ToneAudioNode.ts:52
numberOfOutputs
get numberOfOutputs(): number
The number of outputs of the AudioNode.

Returns number
Example
const node = new Tone.Gain();
console.log(node.numberOfOutputs);
Copy
Inherited from ToneAudioNode.numberOfOutputs

Defined in Tone/core/context/ToneAudioNode.ts:70
releaseCurve
get releaseCurve(): EnvelopeCurve
The shape of the release. See the attack curve types.

Returns EnvelopeCurve
Example
return Tone.Offline(() => {
    const env = new Tone.Envelope({
        release: 0.8
    }).toDestination();
    env.triggerAttack();
    // release curve could also be defined by an array
    env.releaseCurve = [1, 0.3, 0.4, 0.2, 0.7, 0];
    env.triggerRelease(0.2);
}, 1, 1);
Copy
Defined in Tone/component/envelope/Envelope.ts:319
set releaseCurve(curve): void
Parameters
curve: EnvelopeCurve
Returns void
Defined in Tone/component/envelope/Envelope.ts:322
sampleTime
get sampleTime(): number
The duration in seconds of one sample.

Returns number
Inherited from ToneAudioNode.sampleTime

Defined in Tone/core/context/ToneWithContext.ts:99
value
get value(): number
Read the current value of the envelope. Useful for synchronizing visual output to the envelope.

Returns number
Defined in Tone/component/envelope/Envelope.ts:221
Methods
asArray
asArray(length?): Promise<Float32Array>
Render the envelope curve to an array of the given length. Good for visualizing the envelope curve. Rescales the duration of the envelope to fit the length.

Parameters
length: number = 1024
Returns Promise<Float32Array>
Defined in Tone/component/envelope/Envelope.ts:513
cancel
cancel(after?): this
Cancels all scheduled envelope changes after the given time.

Parameters
Optional after: Unit.Time
Returns this
Defined in Tone/component/envelope/Envelope.ts:495
chain
chain(...nodes): this
Connect the output of this node to the rest of the nodes in series.

Parameters
Rest ...nodes: InputNode[]
Returns this
Example
const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/handdrum-loop.mp3");
player.autostart = true;
const filter = new Tone.AutoFilter(4).start();
const distortion = new Tone.Distortion(0.5);
// connect the player to the filter, distortion and then to the master output
player.chain(filter, distortion, Tone.Destination);
Copy
Inherited from ToneAudioNode.chain

Defined in Tone/core/context/ToneAudioNode.ts:249
connect
connect(destination, outputNumber?, inputNumber?): this
Connect the envelope to a destination node.

Parameters
destination: InputNode
outputNumber: number = 0
inputNumber: number = 0
Returns this
Overrides ToneAudioNode.connect

Defined in Tone/component/envelope/Envelope.ts:503
disconnect
disconnect(destination?, outputNum?, inputNum?): this
disconnect the output

Parameters
Optional destination: InputNode
outputNum: number = 0
inputNum: number = 0
Returns this
Inherited from ToneAudioNode.disconnect

Defined in Tone/core/context/ToneAudioNode.ts:234
dispose
dispose(): this
Dispose and disconnect

Returns this
Overrides ToneAudioNode.dispose

Defined in Tone/component/envelope/Envelope.ts:546
fan
fan(...nodes): this
connect the output of this node to the rest of the nodes in parallel.

Parameters
Rest ...nodes: InputNode[]
Returns this
Example
const player = new Tone.Player("https://tonejs.github.io/audio/drum-samples/conga-rhythm.mp3");
player.autostart = true;
const pitchShift = new Tone.PitchShift(4).toDestination();
const filter = new Tone.Filter("G5").toDestination();
// connect a node to the pitch shift and filter in parallel
player.fan(pitchShift, filter);
Copy
Inherited from ToneAudioNode.fan

Defined in Tone/core/context/ToneAudioNode.ts:264
get
get(): EnvelopeOptions
Get the object's attributes.

Returns EnvelopeOptions
Example
const osc = new Tone.Oscillator();
console.log(osc.get());
Copy
Inherited from ToneAudioNode.get

Defined in Tone/core/context/ToneWithContext.ts:170
getValueAtTime
getValueAtTime(time): number
Get the scheduled value at the given time. This will return the unconverted (raw) value.

Parameters
time: Unit.Time
Returns number
Example
const env = new Tone.Envelope(0.5, 1, 0.4, 2);
env.triggerAttackRelease(2);
setInterval(() => console.log(env.getValueAtTime(Tone.now())), 100);
Copy
Defined in Tone/component/envelope/Envelope.ts:465
immediate
immediate(): number
Return the current time of the Context clock without any lookAhead.

Returns number
Example
setInterval(() => {
    console.log(Tone.immediate());
}, 100);
Copy
Inherited from ToneAudioNode.immediate

Defined in Tone/core/context/ToneWithContext.ts:92
now
now(): number
Return the current time of the Context clock plus the lookAhead.

Returns number
Example
setInterval(() => {
    console.log(Tone.now());
}, 100);
Copy
Inherited from ToneAudioNode.now

Defined in Tone/core/context/ToneWithContext.ts:81
set
set(props): this
Set multiple properties at once with an object.

Parameters
props: RecursivePartial<EnvelopeOptions>
Returns this
Example
const filter = new Tone.Filter().toDestination();
// set values using an object
filter.set({
    frequency: "C6",
    type: "highpass"
});
const player = new Tone.Player("https://tonejs.github.io/audio/berklee/Analogsynth_octaves_highmid.mp3").connect(filter);
player.autostart = true;
Copy
Inherited from ToneAudioNode.set

Defined in Tone/core/context/ToneWithContext.ts:215
toDestination
toDestination(): this
Connect the output to the context's destination node.

Returns this
Example
const osc = new Tone.Oscillator("C2").start();
osc.toDestination();
Copy
Inherited from ToneAudioNode.toDestination

Defined in Tone/core/context/ToneAudioNode.ts:216
toFrequency
toFrequency(freq): number
Convert the input to a frequency number

Parameters
freq: Unit.Frequency
Returns number
Example
const gain = new Tone.Gain();
console.log(gain.toFrequency("4n"));
Copy
Inherited from ToneAudioNode.toFrequency

Defined in Tone/core/context/ToneWithContext.ts:132
toMaster
toMaster(): this
Connect the output to the context's destination node.

Returns this
See
toDestination

Deprecated
Inherited from ToneAudioNode.toMaster

Defined in Tone/core/context/ToneAudioNode.ts:226
toSeconds
toSeconds(time?): number
Convert the incoming time to seconds. This is calculated against the current TransportClass bpm

Parameters
Optional time: Unit.Time
Returns number
Example
const gain = new Tone.Gain();
setInterval(() => console.log(gain.toSeconds("4n")), 100);
// ramp the tempo to 60 bpm over 30 seconds
Tone.getTransport().bpm.rampTo(60, 30);
Copy
Inherited from ToneAudioNode.toSeconds

Defined in Tone/core/context/ToneWithContext.ts:121
toString
toString(): string
Convert the class to a string

Returns string
Example
const osc = new Tone.Oscillator();
console.log(osc.toString());
Copy
Inherited from ToneAudioNode.toString

Defined in Tone/core/Tone.ts:106
toTicks
toTicks(time?): number
Convert the input time into ticks

Parameters
Optional time: Unit.Time | TimeClass<number, TimeBaseUnit>
Returns number
Example
const gain = new Tone.Gain();
console.log(gain.toTicks("4n"));
Copy
Inherited from ToneAudioNode.toTicks

Defined in Tone/core/context/ToneWithContext.ts:142
triggerAttack
triggerAttack(time?, velocity?): this
Trigger the attack/decay portion of the ADSR envelope.

Parameters
Optional time: Unit.Time
When the attack should start.

velocity: number = 1
The velocity of the envelope scales the vales. number between 0-1

Returns this
Example
const env = new Tone.AmplitudeEnvelope().toDestination();
const osc = new Tone.Oscillator().connect(env).start();
// trigger the attack 0.5 seconds from now with a velocity of 0.2
env.triggerAttack("+0.5", 0.2);
Copy
Defined in Tone/component/envelope/Envelope.ts:356
triggerAttackRelease
triggerAttackRelease(duration, time?, velocity?): this
triggerAttackRelease is shorthand for triggerAttack, then waiting some duration, then triggerRelease.

Parameters
duration: Unit.Time
The duration of the sustain.

Optional time: Unit.Time
When the attack should be triggered.

velocity: number = 1
The velocity of the envelope.

Returns this
Example
const env = new Tone.AmplitudeEnvelope().toDestination();
const osc = new Tone.Oscillator().connect(env).start();
// trigger the release 0.5 seconds after the attack
env.triggerAttackRelease(0.5);
Copy
Defined in Tone/component/envelope/Envelope.ts:481
triggerRelease
triggerRelease(time?): this
Triggers the release of the envelope.

Parameters
Optional time: Unit.Time
When the release portion of the envelope should start.

Returns this
Example
const env = new Tone.AmplitudeEnvelope().toDestination();
const osc = new Tone.Oscillator({
    type: "sawtooth"
}).connect(env).start();
env.triggerAttack();
// trigger the release half a second after the attack
env.triggerRelease("+0.5");
Copy
Defined in Tone/component/envelope/Envelope.ts:428
Static
getDefaults
getDefaults(): EnvelopeOptions
Returns EnvelopeOptions
Overrides ToneAudioNode.getDefaults

Defined in Tone/component/envelope/Envelope.ts:205

Tone.ScaledEnvelope
↳ EXTENDS Tone.Envelope
Tone.ScaledEnvelop is an envelope which can be scaled to any range. It’s useful for applying an envelope to a frequency or any other non-NormalRange signal parameter.

CONSTRUCTOR
new Tone.ScaledEnvelope ( [ attack ] , [ decay ] , [ sustain ] , [ release ] )
attack	
the attack time in seconds

type: Time or Object
optional
decay	
the decay time in seconds

type: Time
optional
sustain	
a percentage (0-1) of the full amplitude

type: number
optional
release	
the release time in seconds

type: Time
optional
DEFAULTS
{
min : 0 ,
max : 1 ,
exponent : 1
}
EXAMPLE
var scaledEnv = new Tone.ScaledEnvelope({
 	"attack" : 0.2,
 	"min" : 200,
 	"max" : 2000
 });
 scaledEnv.connect(oscillator.frequency);
MEMBERS
max
min
exponent
numberOfOutputs
channelInterpretation
context
channelCount
channelCountMode
numberOfInputs
value
attackCurve
decay
decayCurve
release
releaseCurve
sustain
attack
METHODS
dispose
chain
toMaster
disconnect
fan
triggerRelease
getValueAtTime
triggerAttack
triggerAttackRelease
cancel
Members
.max ↝ number #
The envelope’s max output value. In other words, the value at the peak of the attack portion of the envelope.

</>
.min ↝ number #
The envelope’s min output value. This is the value which it starts at.

</>
.exponent ↝ number #
The envelope’s exponent value.

</>
↳inherited from Tone.AudioNode
.numberOfOutputs ↝ Number READONLY #
The number of outputs coming out of the AudioNode.

</>
↳inherited from Tone.AudioNode
.channelInterpretation ↝ String READONLY #
channelInterpretation determines how individual channels will be treated when up-mixing and down-mixing connections to any inputs to the node. The default value is “speakers”.

</>
↳inherited from Tone.AudioNode
.context ↝ Tone.Context READONLY #
Get the audio context belonging to this instance.

</>
↳inherited from Tone.AudioNode
.channelCount ↝ Number READONLY #
channelCount is the number of channels used when up-mixing and down-mixing connections to any inputs to the node. The default value is 2 except for specific nodes where its value is specially determined.

</>
↳inherited from Tone.AudioNode
.channelCountMode ↝ String READONLY #
channelCountMode determines how channels will be counted when up-mixing and down-mixing connections to any inputs to the node. The default value is “max”. This attribute has no effect for nodes with no inputs.

</>
↳inherited from Tone.AudioNode
.numberOfInputs ↝ Number READONLY #
The number of inputs feeding into the AudioNode. For source nodes, this will be 0.

</>
↳inherited from Tone.Envelope
.value ↝ Number READONLY #
Read the current value of the envelope. Useful for syncronizing visual output to the envelope.

</>
↳inherited from Tone.Envelope
.attackCurve ↝ String or Array #
The shape of the attack. Can be any of these strings: <ul> <li>linear</li> <li>exponential</li> <li>sine</li> <li>cosine</li> <li>bounce</li> <li>ripple</li> <li>step</li> </ul> Can also be an array which describes the curve. Values in the array are evenly subdivided and linearly interpolated over the duration of the attack.

EXAMPLE
env.attackCurve = "linear";
EXAMPLE
//can also be an array
env.attackCurve = [0, 0.2, 0.3, 0.4, 1]
</>
↳inherited from Tone.Envelope
.decay ↝ Time #
After the attack portion of the envelope, the value will fall over the duration of the decay time to it’s sustain value.

</>
↳inherited from Tone.Envelope
.decayCurve ↝ String #
The shape of the decay either “linear” or “exponential”

EXAMPLE
env.decayCurve = "linear";
</>
↳inherited from Tone.Envelope
.release ↝ Time #
After triggerRelease is called, the envelope’s value will fall to it’s miminum value over the duration of the release time.

</>
↳inherited from Tone.Envelope
.releaseCurve ↝ String or Array #
The shape of the release. See the attack curve types.

EXAMPLE
env.releaseCurve = "linear";
</>
↳inherited from Tone.Envelope
.sustain ↝ NormalRange #
The sustain value is the value which the envelope rests at after triggerAttack is called, but before triggerRelease is invoked.

</>
↳inherited from Tone.Envelope
.attack ↝ Time #
When triggerAttack is called, the attack time is the amount of time it takes for the envelope to reach it’s maximum value.

</>
Methods
.dispose ( ) #
↪ returns Tone.ScaledEnvelope	
this

clean up

</>
↳inherited from Tone.AudioNode
.chain ( ) #
nodes	
type: AudioParam or Tone or AudioNode
↪ returns Tone.AudioNode	
this

Connect the output of this node to the rest of the nodes in series.

EXAMPLE
//connect a node to an effect, panVol and then to the master output
 node.chain(effect, panVol, Tone.Master);
 
</>
↳inherited from Tone.AudioNode
.toMaster ( ) #
↪ returns Tone.AudioNode	
this

Connect ‘this’ to the master output. Shorthand for this.connect(Tone.Master)

EXAMPLE
//connect an oscillator to the master output
var osc = new Tone.Oscillator().toMaster();
</>
↳inherited from Tone.AudioNode
.disconnect ( ) #
output	
Either the output index to disconnect if the output is an array, or the node to disconnect from.

type: Number or AudioNode
↪ returns Tone.AudioNode	
this

disconnect the output

</>
↳inherited from Tone.AudioNode
.fan ( ) #
nodes	
type: AudioParam or Tone or AudioNode
↪ returns Tone.AudioNode	
this

connect the output of this node to the rest of the nodes in parallel.

</>
↳inherited from Tone.Envelope
.triggerRelease ( ) #
time	
When the release portion of the envelope should start.

type: Time
default: now
↪ returns Tone.Envelope	
this

Triggers the release of the envelope.

EXAMPLE
//trigger release immediately
 env.triggerRelease();
</>
↳inherited from Tone.Envelope
.getValueAtTime ( ) #
time	
The time in seconds.

type: Number
↪ returns Number	
The scheduled value at the given time.

Get the scheduled value at the given time. This will return the unconverted (raw) value.

</>
↳inherited from Tone.Envelope
.triggerAttack ( ) #
time	
When the attack should start.

type: Time
default: now
velocity	
The velocity of the envelope scales the vales. number between 0-1

type: NormalRange
default: 1
↪ returns Tone.Envelope	
this

Trigger the attack/decay portion of the ADSR envelope.

EXAMPLE
//trigger the attack 0.5 seconds from now with a velocity of 0.2
 env.triggerAttack("+0.5", 0.2);
</>
↳inherited from Tone.Envelope
.triggerAttackRelease ( ) #
duration	
The duration of the sustain.

type: Time
time	
When the attack should be triggered.

type: Time
default: now
velocity	
The velocity of the envelope.

type: number
default: 1
↪ returns Tone.Envelope	
this

triggerAttackRelease is shorthand for triggerAttack, then waiting some duration, then triggerRelease.

EXAMPLE
//trigger the attack and then the release after 0.6 seconds.
env.triggerAttackRelease(0.6);
</>
↳inherited from Tone.Envelope
.cancel ( ) #
after	
type: Time
↪ returns Tone.Envelope	
this

Cancels all scheduled envelope changes after the given time.

