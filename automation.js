let pup=require('puppeteer');
let fs= require('fs');
console.log(process.argv);


(async function()
{
    try{

    let questionsFile=process.argv[2]
    let url="https://stackoverflow.com/"
    let questions=require(questionsFile)

    const browser=await pup.launch({
        headless:false,
        defaultViewport:null,
        args:["--start-maximized"]
        })
    
    let tabs = await browser.pages();
    let tab = tabs[0]
    await tab.goto( url , {waitUntil:"networkidle0"})
    
    // for(let i=0;i<questions.length;i++)
    // {
    questions=await solveProblem(tab,browser,questions)
    // }
    await tab.close()
    await fs.writeFile("solutions.json"  ,JSON.stringify(questions),(err) => {
        if (err) {
            throw err;
        }
        console.log("JSON data is saved.");
    });

    }
    catch(err)
    {
        console.log(err);
    }
})() 

async function solveProblem(tab,browser,questions)
{   

    let curr_url=await tab.url()
    for(let i=0;i<questions.length;i++)
    {
        if(i!=0)
        {
            await tab.goto(curr_url,{waitUntil:"networkidle0"})
        }
        console.log("questions is :"+questions[i].problem);
        await tab.waitForSelector("input[placeholder=Search…]");
        await tab.type("input[placeholder=Search…]",questions[i].problem,{delay :100})
       
        await Promise.all([
            await tab.keyboard.press('Enter'), 
        tab.waitForNavigation({ waitUntil: "networkidle0" })
        ]);


        await tab.waitForSelector(".flush-left.js-search-results")
        let all_questions=await tab.$$(".question-summary.search-result .result-link a")
        console.log("results found are :"+all_questions.length);
        // this loop is for all questions on the page
        // AND WE EXTRACTED AT MOST 3 MOST RELEVANT  QUESTIONS
        questions[i].solutions=[]

        if(all_questions.length==0)
        {
            questions[i].answer_stat=false;
            if(questions[i].wannna_post==true)
            {
                console.log("initiate creating new question");
                await createANewQuestion(tab,browser,questions[i]);


            }else{
                console.log("no need to create a question i will prefer another platform");

            }
        }else{
            questions[i].answer_stat=true;
            for(let j=0;j<all_questions.length&&j<3;j++)
            {
                console.log("href for attribute :"+j);
                let href=await tab.evaluate(function(elem){
                    return elem.getAttribute("href");
                }, all_questions[j] )
                let new_tab= await browser.newPage();
                
                questions[i].solutions.push(await putSolution(new_tab,browser,href))
                
                new_tab.close()
                console.log("mai hoo vo :"+questions[i].solutions[j])
            }
        }
        console.log(" updated script as**************************")
    }
    return questions;
}

async function putSolution(tab,browser,href)
{
    solutions={}

    await tab.goto("https://stackoverflow.com"+href,{waitUntil:"networkidle0"})
    // extract similar question asked by user 
    await tab.waitForSelector("div[id=question-header] a.question-hyperlink",{waitUntil:"networkidle0"})
    
    let question_asked=await tab.evaluate(()=>document.querySelector("div[id=question-header] a.question-hyperlink").textContent)
    solutions.question_asked=question_asked;
    // extract all answers related to that question
    // AND PUT 3 MOST PRAISED ANSWERS IN FILE
    // document.querySelectorAll("div[id=answers] div.answer .post-text")
    await tab.waitForSelector("div[id=answers] div.answer .post-text",{visible:true});

    solutions.answers=await updateAnswer(tab)
    console.log(" filled solutin is "+solutions);
    // console.length(solutions.answers)
    return solutions;
    
}
async function updateAnswer(tab)
{
    answers=[]
    await tab.waitForSelector(".site-footer--container",{visible:true})
    let all_answers_on_page=await tab.$$("div[id=answers] div.answer .post-text")
    console.log(" answers on page are :"+all_answers_on_page.length)
    
    
    for(let i=0;i<all_answers_on_page.length&&i<3;i++)
    {
        answers_list_object={}
        let all_texts=await tab.$$("div[id=answers] div.answer .post-text")
        let all_p_tags=await all_texts[i].$$("p")
        let all_code_tags=await all_texts[i].$$("code")
        console.log(" no of p tags found are :"+all_p_tags.length)

        codes=[]
        for(let j=0;j<all_code_tags.length;j++)
        {
            let temp_ans=await tab.evaluate(function(j){
                this.text=document.querySelectorAll("div[id=answers] div.answer .post-text code")[j].innerText
                return this.text
            },j)
            codes.push(temp_ans);
            // console.log("ans is "+temp_ans);
            // console.log("end of code" );
        }

        // let all_p_tags=await all_texts[i].$$("code")
        text_content=[]
        for(let j=0;j<all_p_tags.length;j++)
        {
            // console.log("value of j is "+j+" and i is "+i);
            let temp_ans=await tab.evaluate(function(j){
                this.text=document.querySelectorAll("div[id=answers] div.answer .post-text p")[j].innerText
                return this.text
            },j)
            text_content.push(temp_ans);
            // console.log("ans is "+temp_ans);
            // console.log("end of text content" );
        }
        answers_list_object.text=text_content;
        // console.log(("content is :"+text_content));
        answers_list_object.codes=codes;
        // console.log("codes is "+codes)
        answers.push(answers_list_object);
        
    }
    return answers;  
} 

async function createANewQuestion(tab,browser,questions)
{
    await tab.goto("https://stackoverflow.com/users/login",{waitUntil:"networkidle0"})
    await tab.waitForSelector("#email",{visible:true});
    let path_of_credentials=questions.credentials;
    // file read credentials .  json
    let temp_data=await fs.promises.readFile(path_of_credentials)
    let data=JSON.parse(temp_data);
    let username=data['username'];
    console.log("username is : "+username);
    let pwd=data['password'];

    await tab.type("#email",username,{delay:100});
    await tab.type("#password",pwd,{delay:100});
    await tab.waitForSelector("button[name=submit-button]",{visible:true});
    console.log("wait completed ");
    await tab.click("button[name=submit-button]")
    await Promise.all([tab.click("button[name=submit-button]"),
        tab.waitForNavigation({waitUntil:"networkidle2"}),
    ]);
   await tab.waitForSelector(".ws-nowrap.s-btn.s-btn__primary",{visible:true});
   await Promise.all([tab.click(".ws-nowrap.s-btn.s-btn__primary"),
   tab.waitForNavigation({waitUntil:"networkidle2"}),
    ]);

    //fill tittle bar
    await tab.waitForSelector("input[id=title]");
    let questions_data=questions.question_data;
    console.log("tittle typed is  "+questions_data.title)
    tab.evaluate(()=>{
        document.querySelector("input[id=title]").value=""
    })
    await tab.type("input[id=title]",questions_data.title)
    
    // fill text in description box
    tab.evaluate(()=>{
        document.querySelector("textarea[id=wmd-input]").value=""
    })
    await tab.type("textarea[id=wmd-input]",questions_data.description)
    await tab.type("input[id=tageditor-replacing-tagnames--input]",questions_data.tags)

    // send code in it  
    let code_i_got=await fs.promises.readFile(questions_data.code_file)
    let final_code=code_i_got+""
    final_code="\n```".concat(final_code.concat("```"))
    console.log("final-code is "+final_code)
    await tab.type("textarea[id=wmd-input]",final_code)
    //  send tag
    tab.evaluate(()=>{
        document.querySelector("input[id=tageditor-replacing-tagnames--input]").value=""
    })
    await tab.type("input[id=tageditor-replacing-tagnames--input]",questions_data.tags)
   
    await tab.waitForSelector(".grid--cell.s-btn.s-btn__primary.s-btn__icon.ws-nowrap.js-begin-review-button.js-gps-track",{visible:true})
    await tab.click(".grid--cell.s-btn.s-btn__primary.s-btn__icon.ws-nowrap.js-begin-review-button.js-gps-track");
    await tab.waitForSelector(".grid--cell.s-btn.s-btn__primary.s-btn__icon.ws-nowrap.js-submit-button",{visible:true});
    await tab.click(".grid--cell.s-btn.s-btn__primary.s-btn__icon.ws-nowrap.js-submit-button")
    let final_time=Date.now()+5000;
    while(final_time>Date.now())
    {
        }

    
}