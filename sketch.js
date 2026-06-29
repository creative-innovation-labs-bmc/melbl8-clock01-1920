let zoneParticles = [[], [], [], []];
let lastSecond, lastMinute;
let mainFont, footerFont, sidebarFont;
let city = "", country = ""; // Empty strings prevent showing "Unavailable"
let locationFetched = false;

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 402;
const DESIGN_WIDTH = 3840;
const DESIGN_HEIGHT = 804;
const SCALE = CANVAS_WIDTH / DESIGN_WIDTH;
const PARTICLES_PER_ZONE = 2000;

function scaled(value) {
  return value * SCALE;
}

function preload() {
  mainFont = loadFont('MP-B.ttf');
  footerFont = loadFont('MS-Bk.otf');
  sidebarFont = loadFont('MP-M.ttf');
}

function setup() {
  pixelDensity(1);

  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  canvas.parent('stage');

  // Start the resilient fetch process
  fetchLocation();

  let zoneWidth = width / 4;
  for (let z = 0; z < 4; z++) {
    let minX = z * zoneWidth;
    let maxX = (z + 1) * zoneWidth;
    for (let i = 0; i < PARTICLES_PER_ZONE; i++) {
      zoneParticles[z].push(new Particle(minX, maxX, z));
    }
  }

  lastSecond = second();
  lastMinute = minute();
}

// Keep the canvas locked to the signage resolution.
function windowResized() {
  resizeCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
}

// --- RESILIENT FETCH LOGIC ---
function fetchLocation() {
  if (locationFetched) return; // Stop retrying once we have the data

  // Using ipapi.co with a timeout/error handling
  loadJSON('https://ipapi.co/json/', handleLocation, handleLocationError);
}

function handleLocation(data) {
  if (data && data.city && data.country_name) {
    city = data.city.toUpperCase();
    country = data.country_name.toUpperCase();
    locationFetched = true;
    console.log("Location successfully synchronized: " + city);
  }
}

function handleLocationError(err) {
  console.log("Location fetch pending... retrying in 30 seconds.");
  // Wait 30 seconds and try again - ideal for digital signage reboots
  setTimeout(fetchLocation, 30000);
}

function draw() {
  background(28, 27, 28); // #1C1B1C

  let h = nf(hour(), 2);
  let m = nf(minute(), 2);
  let s = nf(second(), 2);
  let digits = [h[0], h[1], m[0], m[1]];

  let monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  let dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  let dateStr = day() + " " + monthNames[month() - 1] + " " + year();
  let dayStr = dayNames[new Date().getDay()];

  // Conditional sidebar: Only adds location if fetched successfully
  let fullSidebarStr = "";
  if (locationFetched) {
    fullSidebarStr += city + ", " + country + " — ";
  }
  fullSidebarStr += dateStr + " — " + dayStr;

  if (second() !== lastSecond) {
    applyVibration(scaled(15));
    lastSecond = second();
  }

  if (minute() !== lastMinute) {
    shatterEffect();
    lastMinute = minute();
  }

  // --- PARTICLE LAYER ---
  let zoneWidth = width / 4;
  for (let z = 0; z < 4; z++) {
    let xOffset = (z * zoneWidth) + (zoneWidth / 2);
    let yOffset = height / 2 - scaled(140);
    let pts = textToPoints(digits[z], xOffset, yOffset, scaled(750), Math.max(4, Math.round(scaled(9))));

    for (let i = 0; i < zoneParticles[z].length; i++) {
      let p = zoneParticles[z][i];
      if (i < pts.length) {
        p.setTarget(pts[i].x, pts[i].y);
      } else {
        p.setTarget(null, null);
      }
      p.behaviors();
      p.update();
      p.show(xOffset, yOffset);
    }
  }

  // --- TOP OVERLAY LAYER ---
  drawLayout(h + ":" + m + ":" + s, fullSidebarStr);
}

function drawLayout(time, sidebarText) {
  let zoneW = width / 4;
  let dividerLerp = map(sin(frameCount * 0.008), -1, 1, 0, 0.3);
  let white = color('#FFFFFF');
  let grey = color('#4e5859');
  let dividerCol = lerpColor(white, grey, dividerLerp);

  for (let i = 0; i < 4; i++) {
    let startX = i * zoneW;

    textFont(footerFont);
    fill(255);
    noStroke();
    textAlign(LEFT, BOTTOM);
    textSize(scaled(50));
    text(time, startX + scaled(50), height - scaled(50));

    push();
    textFont(sidebarFont);
    fill('#8E9C9C');
    translate(startX + zoneW - scaled(60), height - scaled(50));
    rotate(-HALF_PI);
    textAlign(LEFT, CENTER);
    textSize(scaled(24));
    text(sidebarText, 0, 0);
    pop();

    stroke(dividerCol);
    strokeWeight(scaled(2.0)); // Thick architectural dividers
    line((i + 1) * zoneW, 0, (i + 1) * zoneW, height);
  }
}

function applyVibration(s) {
  for (let z = 0; z < 4; z++) {
    for (let p of zoneParticles[z]) {
      p.applyForce(p5.Vector.random2D().mult(random(s)));
    }
  }
}

function shatterEffect() {
  for (let z = 0; z < 4; z++) {
    for (let p of zoneParticles[z]) {
      p.applyForce(p5.Vector.random2D().mult(random(scaled(250), scaled(450))));
    }
  }
}

function textToPoints(txt, x, y, size, step) {
  let pts = [];
  let t = createGraphics(600, 600);
  t.pixelDensity(1);
  t.textFont(mainFont);
  t.textSize(size * 0.5);
  t.textAlign(CENTER, CENTER);
  t.fill(255);
  t.text(txt, 300, 300);
  t.loadPixels();
  for (let i = 0; i < t.width; i += step) {
    for (let j = 0; j < t.height; j += step) {
      if (t.pixels[(i + j * t.width) * 4] > 127) {
        pts.push({ x: x + (i - 300) * 2, y: y + (j - 300) * 2 });
      }
    }
  }
  t.remove();
  return pts;
}

class Particle {
  constructor(minX, maxX, zoneIndex) {
    this.minX = minX;
    this.maxX = maxX;
    this.zoneIndex = zoneIndex;
    this.pos = createVector(random(this.minX, this.maxX), random(height));
    this.target = createVector(this.pos.x, this.pos.y);
    this.vel = createVector();
    this.acc = createVector();
    this.rActiveBase = scaled(8.4);
    this.rIdle = scaled(5.6);
    this.maxspeed = scaled(22);
    this.maxforce = scaled(2.0);
    this.colorActive = color('#89C925');
    this.colorIdle = color('#2A3320');
    this.currentColor = color('#2A3320');
  }

  setTarget(x, y) {
    if (x !== null && y !== null) {
      this.target.set(x, y);
      this.isTargeted = true;
    } else {
      this.isTargeted = false;
    }
  }

  behaviors() {
    if (this.isTargeted) {
      this.applyForce(this.arrive(this.target));
    } else {
      let breathPhase = frameCount * 0.008 + (this.zoneIndex * PI / 2);
      let breathingStrength = map(sin(breathPhase), -1, 1, scaled(0.01), scaled(0.08));
      let n = noise(this.pos.x * 0.003, this.pos.y * 0.003, frameCount * 0.005);
      this.applyForce(p5.Vector.fromAngle(TWO_PI * n).mult(scaled(0.1)));
      let zoneCenter = createVector((this.minX + this.maxX) / 2, height / 2 - scaled(140));
      this.applyForce(p5.Vector.sub(zoneCenter, this.pos).setMag(breathingStrength));
    }
    this.applyForce(p5.Vector.random2D().mult(scaled(0.2)));
  }

  applyForce(f) {
    this.acc.add(f);
  }

  update() {
    this.vel.add(this.acc).limit(this.maxspeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.vel.mult(0.92);
    if (this.pos.x < this.minX || this.pos.x > this.maxX) {
      this.vel.x *= -1;
    }
    if (this.pos.y < 0 || this.pos.y > height) {
      this.vel.y *= -1;
    }
  }

  show(cX, cY) {
    let targetC = this.isTargeted ? this.colorActive : this.colorIdle;
    this.currentColor = lerpColor(this.currentColor, targetC, 0.08);
    stroke(this.currentColor);

    if (this.isTargeted) {
      // Massive radial scaling, reduced proportionally for 1920 x 402 output.
      let d = dist(this.pos.x, this.pos.y, cX, cY);
      let radialScale = map(d, 0, scaled(300), 3.5, 0.8);
      radialScale = constrain(radialScale, 0.8, 3.5);
      strokeWeight(this.rActiveBase * radialScale);
      point(this.pos.x, this.pos.y);
    } else {
      let breathPhase = frameCount * 0.01 + (this.zoneIndex * PI / 2) + (this.pos.x * 0.005);
      let currentR = map(sin(breathPhase), -1, 1, this.rIdle * 0.8, this.rIdle * 2.5);
      strokeWeight(currentR);
      point(this.pos.x, this.pos.y);
    }
  }

  arrive(t) {
    let d = p5.Vector.sub(t, this.pos);
    let s = d.mag() < scaled(120) ? map(d.mag(), 0, scaled(120), 0, this.maxspeed) : this.maxspeed;
    return p5.Vector.sub(d.setMag(s), this.vel).limit(this.maxforce);
  }
}
