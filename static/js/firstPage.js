
const pCanvas = document.getElementById('particle-canvas');
const pCtx = pCanvas.getContext('2d');
pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight;
let particles = [];
class Particle {
    constructor() {
        this.x = Math.random() * pCanvas.width;
        this.y = Math.random() * pCanvas.height;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > pCanvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > pCanvas.height) this.vy *= -1;
    }
    draw() {
        pCtx.beginPath(); pCtx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        pCtx.fillStyle = '#00FFCC'; pCtx.fill();
    }
}
for (let i = 0; i < 80; i++) particles.push(new Particle());
function animateParticles() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    for(let i=0; i<particles.length; i++) {
        for(let j=i+1; j<particles.length; j++) {
            let d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
            if(d < 100) {
                pCtx.beginPath(); pCtx.moveTo(particles[i].x, particles[i].y);
                pCtx.lineTo(particles[j].x, particles[j].y);
                pCtx.strokeStyle = `rgba(0, 255, 204, ${1 - d/100})`;
                pCtx.stroke();
            }
        }
    }
    requestAnimationFrame(animateParticles);
}
animateParticles();
