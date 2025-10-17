const meses = { "JAN":1,"FEV":2,"MAR":3,"ABR":4,"MAI":5,"JUN":6,"JUL":7,"AGO":8,"SET":9,"OUT":10,"NOV":11,"DEZ":12 };

function formatarDataAtual(){ 
    const agora=new Date(); 
    const mesesArr=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"]; 
    const dia=String(agora.getDate()).padStart(2,'0'); 
    const mes=mesesArr[agora.getMonth()]; 
    const ano=agora.getFullYear(); 
    return `${dia}/${mes}/${ano}`; 
}

function lerArquivo(){
    const file=document.getElementById("fileInput").files[0];
    if(!file){ alert("Selecione um arquivo .txt ou .odt!"); return; }
    const reader=new FileReader();
    if(file.name.toLowerCase().endsWith(".txt")){
        reader.onload=e=>{
            document.getElementById("inputText").value=e.target.result;
            processar();
        };
        reader.readAsText(file,"UTF-8");
    } else if(file.name.toLowerCase().endsWith(".odt")){
        reader.onload=e=>{
            JSZip.loadAsync(e.target.result).then(zip=>zip.file("content.xml").async("string"))
            .then(xmlText=>{
                const parser=new DOMParser();
                const xmlDoc=parser.parseFromString(xmlText,"text/xml");
                let texto="";
                const ps=xmlDoc.getElementsByTagName("text:p");
                for(let i=0;i<ps.length;i++) texto+=ps[i].textContent+"\n";
                document.getElementById("inputText").value=texto;
                processar();
            }).catch(err=>alert("Erro ao ler o arquivo .odt: "+err));
        };
        reader.readAsArrayBuffer(file);
    }
}

function converterData(text, mesPadrao, anoPadrao){
    if(!text) return "-";
    text=text.toUpperCase().replace(/\s+/g,'');
    const match=text.match(/(\d{2})(\d{2})(\d{2})P(?:\/?([A-Z]{3}))?(?:\/?(\d{4}))?/);
    if(!match) return "Formato inválido";
    const [,dia,hora,minuto,mesStr,anoStr]=match;
    const mes = mesStr ? meses[mesStr] : mesPadrao ? meses[mesPadrao] : 1;
    const ano = anoStr ? anoStr : anoPadrao ? anoPadrao : "YYYY";
    return `${dia}/${String(mes).padStart(2,'0')}/${ano} ${hora}:${minuto}`;
}

function calcularDuracao(inicio, fim) {
    const parseData = s => {
        const [data, hora] = s.split(" ");
        const [d, m, a] = data.split("/").map(Number);
        const [h, min] = hora.split(":").map(Number);
        return new Date(a, m - 1, d, h, min);
    };
    try {
        const d1 = parseData(inicio);
        const d2 = parseData(fim);
        const diffMs = d2 - d1;
        if (isNaN(diffMs) || diffMs < 0) return "-";
        const totalMin = diffMs / 60000;
        const dias = Math.floor(totalMin / (60 * 24));
        const horas = Math.floor((totalMin % (60 * 24)) / 60);
        const minutos = Math.floor(totalMin % 60);
        return `${dias} dia${dias!==1?"s":""}, ${horas} hora${horas!==1?"s":""} e ${minutos} minuto${minutos!==1?"s":""}`;
    } catch {
        return "-";
    }
}

function processar(){
    const input=document.getElementById("inputText").value.trim();
    const linhas=input.split(/\n+/).map(l=>l.trim()).filter(l=>l.length>0);
    const parsedData=[];
    let currentMission=null;

    for(let i=0;i<linhas.length;i++){
        const linha=linhas[i];
        let omsAno=null, omsMes=null, oms="-";
        const omsMatch=linha.match(/\(?\s*OMS\s*(?:n[ºo]?|:)?\s*([0-9]+)\/(\d{4})\)?/i);
        if(omsMatch){ oms=omsMatch[1]+"/"+omsMatch[2]; omsAno=omsMatch[2]; }

        const periodoMatch=linha.match(/no período de (\d{6}P(?:\/?[A-Z]{3}(?:\/?\d{4})?)?)\s*a\s*(\d{6}P(?:\/?[A-Z]{3}(?:\/?\d{4})?)?)/i);
        if(periodoMatch){
            if(currentMission) parsedData.push(currentMission);
            let codigoMensagem="-";
            for(let j=i;j<i+6 && j<linhas.length;j++){
                const l=linhas[j];
                const codigoMsgMatch=l.match(/\b(?:mensagem|msg)\s*([A-Z0-9\-\/]+)/i);
                const omsMatch2=l.match(/\(?\s*OMS\s*(?:n[ºo]?|:)?\s*([0-9]+)\/(\d{4})\)?/i);
                if(codigoMsgMatch) codigoMensagem=codigoMsgMatch[1];
                if(omsMatch2){ oms=omsMatch2[1]+"/"+omsMatch2[2]; if(!omsAno) omsAno=omsMatch2[2]; if(!omsMes) omsMes=omsMatch2[1]; }
            }
            const dataInicial=converterData(periodoMatch[1], omsMes, omsAno);
            const dataFinal=converterData(periodoMatch[2], omsMes, omsAno);
            currentMission={
                dataInicial,
                dataFinal,
                duracao: calcularDuracao(dataInicial, dataFinal),
                codigoMensagem,
                oms,
                militares:[]
            };
            continue;
        }

        if(currentMission && i+2<linhas.length){
            const posto=linhas[i]; const nip=linhas[i+1]; const nome=linhas[i+2];
            if(/^\d{2}\.\d{4}\.\d{2,3}$/.test(nip)){
                currentMission.militares.push({posto,nip,nome});
                i+=2;
            }
        }
    }
    if(currentMission) parsedData.push(currentMission);
    exibirResultado(parsedData);
}

function exibirResultado(parsedData){
    const resultDiv=document.getElementById("result");
    if(parsedData.length===0){ 
        resultDiv.innerHTML=`<p class="alerta">Nenhum deslocamento identificado. Verifique o texto e tente novamente.</p>`; 
        return; 
    }
    let html="";
    parsedData.forEach((missao,idx)=>{
        html+=`<div class="missao-card"><h3>📘 Missão ${idx+1}</h3><table>
        <tr><th>Data Inicial</th><th>Data Final</th><th>Duração</th><th>Código da Mensagem</th><th>OMS</th><th>Posto/Graduação</th><th>NIP</th><th>Nome</th></tr>`;
        if(missao.militares.length>0){
            missao.militares.forEach(m=>{
                html+=`<tr><td>${missao.dataInicial}</td><td>${missao.dataFinal}</td><td>${missao.duracao}</td><td>${missao.codigoMensagem}</td><td>${missao.oms}</td><td>${m.posto}</td><td>${m.nip}</td><td>${m.nome}</td></tr>`;
            });
        } else{
            html+=`<tr><td>${missao.dataInicial}</td><td>${missao.dataFinal}</td><td>${missao.duracao}</td><td>${missao.codigoMensagem}</td><td>${missao.oms}</td><td colspan="3" style="text-align:center;">Sem militares registrados</td></tr>`;
        }
        html+="</table></div>";
    });
    resultDiv.innerHTML=html;
}

document.getElementById("footer").innerHTML=`Sistema em uso por: <span>MN NELSON</span> — Atualizado em <span>${formatarDataAtual()}</span><br>© 2025 - OS EXTRATOR - DN 111.2 | Sistema de Apoio Administrativo Interno.`;

