# Expression cookbook

## Motion
```js
// Inertial settle on any property with keyframes
amp=.05; freq=4; decay=7;
n=0; if(numKeys>0){n=nearestKey(time).index; if(key(n).time>time)n--;}
if(n==0){value}else{t=time-key(n).time; v=velocityAtTime(key(n).time-.001);
value+v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t)}

// Elastic from 0 to value over 1s starting at inPoint
t=time-inPoint; if(t<=0) 0 else { s=Math.min(t/1,1);
value*(1-Math.exp(-6*s)*Math.cos(10*s)) }

// Follow a layer with lag
thisComp.layer("Lead").transform.position.valueAtTime(time-0.1)

// Orbit
c=[960,540]; r=200; a=time*2*Math.PI/4;
c+[Math.cos(a),Math.sin(a)]*r

// Stagger across layer index (apply to Opacity)
d=(index-thisComp.layer("Start").index)*0.05;
linear(time-inPoint-d,0,0.3,0,100)
```

## Text
```js
// Typewriter (Source Text)
s=value; n=Math.floor(linear(time,inPoint,inPoint+1.5,0,s.length)); s.substr(0,n)

// Scrambling number
v=Math.round(ease(time,0,1.5,0,effect("Target")("Slider")));
v.toString()
```

## Layout
```js
// Pin a layer's bottom to another layer's bottom
r=thisComp.layer("Card").sourceRectAtTime(time,false);
p=thisComp.layer("Card").transform.position;
[p[0], p[1]+r.top+r.height]

// Grid placement from index
cols=4; gap=220; i=index-1;
[200+(i%cols)*gap, 200+Math.floor(i/cols)*gap]
```

## Utility
```js
clamp(value,0,100)
linear(t,tMin,tMax,v1,v2)  // linear map
ease(t,tMin,tMax,v1,v2)    // smooth map
seedRandom(index,true); random(0.8,1.2)  // stable random per layer
```
