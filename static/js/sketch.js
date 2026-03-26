let capture, socket, hands, isStarted = false, canPlay = true;
let allUsersHands = {};
let ac = new AudioContext();
let soundPool = {};
let myInstrument = "acoustic_grand_piano";
let myUsername = "神秘音乐家";
let particlesMain = [];
// 1. 乐器分类与颜色方案
const instrumentCategories = {
  "Piano": { color: "#00FFCC", list: ["acoustic_grand_piano", "bright_acoustic_piano", "electric_piano_1", "harpsichord"] },
  "Chromatic": { color: "#FFCC00", list: ["celesta", "glockenspiel", "music_box", "vibraphone", "marimba"] },
  "Organ": { color: "#FF5500", list: ["drawbar_organ", "percussive_organ", "rock_organ", "accordion"] },
  "Guitar": { color: "#00AAFF", list: ["acoustic_guitar_nylon", "acoustic_guitar_steel", "electric_guitar_clean", "distortion_guitar"] },
  "Strings": { color: "#CC00FF", list: ["violin", "viola", "cello", "contrabass", "orchestral_harp"] },
  "Brass": { color: "#FFD700", list: ["trumpet", "trombone", "tuba", "french_horn"] },
  "Reed/Pipe": { color: "#00FF66", list: ["soprano_sax", "alto_sax", "clarinet", "flute", "pan_flute"] },
  "Synth": { color: "#FF00AA", list: ["lead_1_square", "lead_2_sawtooth", "pad_1_new_age", "fx_3_crystal"] }
};

const catNames = Object.keys(instrumentCategories);
let curCatIdx = 0, curInstIdx = 0;
let lastWristPos = { x: 0.5, y: 0.5 };
let gestureCooldown = 0;

const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 9], [9, 13], [13, 17], [17, 0], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16], [17, 18], [18, 19], [19, 20]];

// 加载音色并更新 UI
function loadToPool(name) {
    let statusNode = document.getElementById('status-info');
    if (soundPool[name]) {
        if (statusNode) statusNode.innerText = "✅ 就绪: " + name;
        return;
    }
    if (statusNode) statusNode.innerText = "⏳ 加载中: " + name;

    Soundfont.instrument(ac, name, { soundfont: 'MusyngKite' }).then(inst => {
        soundPool[name] = inst;
        if (statusNode) statusNode.innerText = "✅ 就绪: " + name;
    });
}

// 播放切换提示音 (清脆的电子音)
function playUIFeedback() {
    if (ac.state === 'suspended') ac.resume();
    let osc = ac.createOscillator();
    let gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.1);
}

function setup() {
    createCanvas(windowWidth, windowHeight).parent('canvas-container');
    document.getElementById('join-btn').addEventListener('click', () => {
        let inputName = document.getElementById('username-input').value.trim();
        if (inputName !== "") myUsername = inputName;
        if (ac.state === 'suspended') ac.resume();
        
        document.getElementById('login-screen').style.opacity = '0';
        setTimeout(() => { 
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('instrument-hud').style.display = 'block';
        }, 800);
        document.getElementById('ui-layer').style.display = 'block';
        startExperience();
    });
}

function startExperience() {
    updateInstrumentUI();
    socket = io.connect(window.location.origin);// 接收数据时，记录当前时间戳
    socket.on('update_skeletons', (data) => { 
        allUsersHands[data.user_id] = {
            hands: data.hands,
            lastUpdate: Date.now() // 新增：记录收到数据的时间
        };
    });

    capture = createCapture({ video: { facingMode: "user" }, audio: false }, () => { isStarted = true; });
    capture.size(640, 480);
    capture.hide();

    hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7 });
    hands.onResults(onHandResults);

    const camera = new Camera(capture.elt, {
        onFrame: async () => { await hands.send({ image: capture.elt }); },
        width: 640, height: 480
    });
    camera.start();
}

function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
        let hand = results.multiHandLandmarks[0];
        let wrist = hand[0];

        // --- 挥动手势检测逻辑 ---
        if (gestureCooldown > 0) {
            gestureCooldown--;
        } else {
            let dx = wrist.x - lastWristPos.x;
            let dy = wrist.y - lastWristPos.y;
            const threshold = 0.15;

            if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
                // 左右挥动：切换分类 (镜像处理: dx < 0 为右挥)
                if (dx < 0) { changeCategory(1); triggerArrow('arr-right'); }
                else { changeCategory(-1); triggerArrow('arr-left'); }
                gestureCooldown = 25;
            } else if (Math.abs(dy) > threshold) {
                // 上下挥动：切换乐器
                if (dy < 0) { changeInstrument(-1); triggerArrow('arr-up'); }
                else { changeInstrument(1); triggerArrow('arr-down'); }
                gestureCooldown = 20;
            }
        }
        lastWristPos = { x: wrist.x, y: wrist.y };

        // --- 拳头检测与发送 ---
        let wristPt = hand[0];
        let fingerPairs = [[2, 4], [5, 8], [9, 12], [13, 16], [17, 20]];
        let ratios = fingerPairs.map(([m, t]) => dist(hand[m].x, hand[m].y, wristPt.x, wristPt.y) > 0 ? dist(hand[t].x, hand[t].y, wristPt.x, wristPt.y)/dist(hand[m].x, hand[m].y, wristPt.x, wristPt.y) : 0);
        let fistPercent = constrain(map(ratios.reduce((a,b)=>a+b)/5, 1.8, 1.1, 0, 100), 0, 100);

        socket.emit('my_hand_data', [{
            landmarks: hand, fistPercent: fistPercent,
            instrument: myInstrument, username: myUsername
        }]);
    }
}

function changeCategory(dir) {
    curCatIdx = (curCatIdx + dir + catNames.length) % catNames.length;
    curInstIdx = 0;
    updateInstrumentUI();
}

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Change the current instrument by a given direction.
 * @param {number} dir - 1 to go forward, -1 to go backward.
 */
/*******  567b0184-c022-47ca-8fc1-bd2159bad884  *******/
function changeInstrument(dir) {
    let list = instrumentCategories[catNames[curCatIdx]].list;
    curInstIdx = (curInstIdx + dir + list.length) % list.length;
    updateInstrumentUI();
}

function updateInstrumentUI() {
    let cat = catNames[curCatIdx];
    let data = instrumentCategories[cat];
    myInstrument = data.list[curInstIdx];
    
    // 更新 DOM
    const hud = document.getElementById('instrument-hud');
    hud.style.borderColor = data.color;
    hud.style.boxShadow = `0 0 30px ${data.color}44`;
    
    document.getElementById('current-cat-name').innerText = cat.toUpperCase();
    document.getElementById('current-cat-name').style.color = data.color;
    document.getElementById('current-inst-name').innerText = myInstrument.replace(/_/g, ' ');
    
    loadToPool(myInstrument);
    playUIFeedback();
}

function triggerArrow(id) {
    let el = document.getElementById(id);
    el.classList.add('active-arrow');
    setTimeout(() => el.classList.remove('active-arrow'), 300);
}

function draw() {
    //if (!isStarted) return;
    background(10, 15, 20);let now = Date.now();
    
    for (let sid in allUsersHands) {
        let userData = allUsersHands[sid];
        
        // --- 核心修复：如果超过 1000 毫秒没更新，则删除该用户数据并跳过渲染 ---
        if (now - userData.lastUpdate > 1000) {
            delete allUsersHands[sid];
            continue; 
        }

        let isMe = (sid === socket.id);
        let userColor = isMe ? '#00FFCC' : hsvToHex(sid);
        
        // 注意：现在的结构是 userData.hands
        userData.hands.forEach(handData => {
            drawSkeleton(handData.landmarks, userColor);
            
            let tx = (1 - handData.landmarks[0].x) * width;
            let ty = handData.landmarks[0].y * height + 30;
            textAlign(CENTER);
            fill(userColor); textSize(16); text(handData.username, tx, ty);
            fill(255, 150); textSize(11); text(handData.instrument.replace(/_/g, ' '), tx, ty + 18);
        });
    }
    
    // 碰撞检测逻辑保持不变...
    checkCollisions();


    for (let particle of particlesMain) {
        particle.update();
        particle.display();
    }

    for (let i = 0; i < particlesMain.length; i++) {
        for (let j = i + 1; j < particlesMain.length; j++) {
            let distance = dist(
                particlesMain[i].x,
                particlesMain[i].y,
                particlesMain[j].x,
                particlesMain[j].y
            );
            if (distance < 200) {
                strokeWeight(2);
                stroke(0, 255, 204, 255-(distance)*255/200);
                line(particlesMain[i].x, particlesMain[i].y, particlesMain[j].x, particlesMain[j].y);
            }
        }
    }
}

function checkCollisions() {
    let ids = Object.keys(allUsersHands);
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            // 注意这里从 userData.hands 中取数据
            let h1 = allUsersHands[ids[i]].hands[0];
            let h2 = allUsersHands[ids[j]].hands[0];
            if (!h1 || !h2) continue;
            
            let p1 = {x: (1-h1.landmarks[4].x)*width, y: h1.landmarks[4].y*height};
            let p2 = {x: (1-h2.landmarks[4].x)*width, y: h2.landmarks[4].y*height};
            
            if (dist(p1.x, p1.y, p2.x, p2.y) < 50 && canPlay) {
                playSound(p1.x, p1.y,h1);
                playSound(p2.x, p2.y,h2);
                stroke(255, 255, 0); strokeWeight(4); line(p1.x, p1.y, p2.x, p2.y);
                stroke(255, 255, 0); strokeWeight(4); line(p1.x, p1.y, p2.x, p2.y);
                canPlay = false; setTimeout(()=>canPlay=true, 200);
            }
        }
    }
}
function playSound(x,y,hand) {
    let inst = soundPool[hand.instrument];
    if (inst) {
        let note = int(map(hand.fistPercent, 0, 100, 0, 128));
        let r = int(map(hand.fistPercent, 0, 100, 5, 20));
        particlesMain.push(new ParticleNew(x,y,r));
        inst.play(note, ac.currentTime, { gain: 1 });
    }
}

function drawSkeleton(pts, col) {
    stroke(col); strokeWeight(3); noFill();
    HAND_CONNECTIONS.forEach(([i, j]) => {
        line((1-pts[i].x)*width, pts[i].y*height, (1-pts[j].x)*width, pts[j].y*height);
    });
    noStroke(); fill(255);
    pts.forEach(p => ellipse((1-p.x)*width, p.y*height, 6, 6));
}

function hsvToHex(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 80%, 60%)`;
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }


class ParticleNew {

    constructor(x,y,r) {
      this.r = r;
      this.x = x;
      this.y = y;
      this.xoff = random(1000);
      this.yoff = random(1000);
      this.xspeed = map(noise(this.xoff), 0, 1, -2, 2);
      this.yspeed = map(noise(this.yoff), 0, 1, -2, 2);
    }
  
    update() {
      this.x += this.xspeed;
      this.y += this.yspeed;
  
      if (this.x > width || this.x < 0) {
        this.xspeed *= -1;
      }
  
      if (this.y > height || this.y < 0) {
        this.yspeed *= -1;
      }
  
      this.xoff += 0.01;
      this.yoff += 0.01;
    }
  
    display() {
      let r = 120;
      let g = 100;
      let b = noise(this.xoff + this.yoff) * 255;
      fill(r, g, b, 150);
      fill('#00FFCC')
      noStroke();
      ellipse(this.x, this.y, this.r , this.r );
    }
  }
  