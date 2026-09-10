// Small live checks only; never print the API key or short-lived credentials.
const origin = process.env.VOICE_TEST_ORIGIN || 'http://localhost:3210';
for (const brain of ['terra','sol','astra']) {
 const start=Date.now();
 const response=await fetch(origin+'/api/brain',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({brain,language:'uk',question:'Скільки буде 2 плюс 2? Відповідай одним коротким реченням.',history:[]})});
 const data=await response.json();
 console.log(JSON.stringify({brain,status:response.status,model:data.model,answer:data.answer,error:data.error,seconds:Math.round((Date.now()-start)/1000)}));
 if(!response.ok)process.exitCode=1;
}
