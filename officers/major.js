(function(){
WARDBG("Major UI Loaded.");

class MajorUI {
    constructor(){
        this.state={
            user:null,
            chain:null,
            enemies:[],
            faction:[],
            ai:null
        };
        this.drawFrame();
        this.bind();
        WAR_GENERAL.signals.listen("SITREP_UPDATE",d=>this.update(d));
    }

    drawFrame(){
        const root=document.createElement("div");
        root.id="major-ui-root";
        root.style.cssText=`
            position:fixed;top:0;left:0;z-index:2147483647;
        `;
        this.shadow=root.attachShadow({mode:"open"});

        this.shadow.innerHTML=`
            <style>
                #btn{position:fixed;bottom:20px;left:20px;
                     width:50px;height:50px;border-radius:50%;
                     background:#000;color:#0ff;border:2px solid #0ff;
                     display:flex;align-items:center;justify-content:center;
                     cursor:pointer;}
                #panel{
                    position:fixed;top:0;left:0;width:350px;height:100vh;
                    background:#000;color:#0ff;border-right:2px solid #0ff;
                    transform:translateX(-100%);transition:0.25s;
                    font-family:monospace;font-size:12px;overflow-y:auto;
                }
                #panel.on{ transform:translateX(0); }
            </style>
            <div id="btn">N</div>
            <div id="panel">
                <div id="content">Awaiting intel...</div>
            </div>
        `;

        document.body.appendChild(root);
    }

    bind(){
        const btn=this.shadow.querySelector("#btn");
        const panel=this.shadow.querySelector("#panel");
        btn.onclick=()=>panel.classList.toggle("on");
    }

    update(d){
        this.state.user=d.user;
        this.state.chain=d.chain;
        this.state.enemies=d.enemyFactionMembers;
        this.state.faction=d.factionMembers;
        this.state.ai=d.ai;
        this.render();
    }

    render(){
        const c=this.shadow.querySelector("#content");
        if(!this.state.user){ c.innerHTML="Awaiting intel..."; return; }

        c.innerHTML=`
            <b>${this.state.user.name}</b><br>
            Level: ${this.state.user.level}<br>
            HP: ${this.state.user.hp}/${this.state.user.max_hp}<br><br>
            <b>Chain:</b> ${this.state.chain.hits} hits (${this.state.chain.timeLeft}s)<br><br>
            <b>Enemies Online:</b> ${this.state.enemies.length}<br>
            <b>Threat:</b> ${Math.round(this.state.ai.threat*100)}%<br>
            <b>Risk:</b> ${Math.round(this.state.ai.risk*100)}%<br>
        `;
    }
}

new MajorUI();

})();
