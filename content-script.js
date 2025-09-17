class EmpathyDetector {
  constructor() {
    this.popup = null;
    this.currentInput = null;
    this.currentController = null;

    this.init();
  }

  async init() {
    const availability = await LanguageModel.availability();
    console.log('llm', { availability });

    if (availability === 'available') {
      this.createPopup();
      document.addEventListener('input', this.handleInput.bind(this));
      return;
    }

    if (availability === 'downloadable') {
      //
    }
    if (availability === 'downloading') {
      //
    }
  }

  async handleInput(event) {
    // cancel previous call
    if (this.currentController) {
      this.currentController.abort('keystroke');
    }

    const el = event.target;
    const istext = isTextInput(el);
    if (!istext) return;

    const text = getTextContent(el);

    const resp = await this.query(text);

    if (!resp) return;
    this.renderResp(el, resp);
  }

  renderResp(inputElement, resp) {
    this.currentInput = inputElement;

    const values = parseResp(resp);
    const notmsg = !values.message;
    if (notmsg) {
      return;
    }

    const avrg = (values.tone + values.sentiment + values.empathy) / 3;
    if (isNaN(avrg)) {
      return;
    }

    this.positionPopup();

    const col = avrg <= 3.5 ? 'red' : avrg < 6.3 ? 'yellow' : 'green';
    this.popup.style.background = colours[col];

    const content = this.popup.querySelector('span');
    if (content) {
      content.textContent = Math.floor(avrg);
    }
  }

  createPopup() {
    // existing
    const popup = document.createElement('div');
    popup.id = 'empathii';
    popup.innerHTML = `
<button>&times;</button>
<span>(e)</span>
<p></p>`;
    document.body.appendChild(popup);

    popup.querySelector('button').addEventListener('click', () => {
      this.hidePopup();
    });

    this.popup = popup;
  }

  async query(text) {
    const abort = new AbortController();
    this.currentController = abort;

    try {
      const resp = await promptLLM(text, abort.signal);
      return resp;
    } catch {
      // aborted
    }
  }

  hidePopup() {
    if (this.popup) {
      this.popup.style.display = 'none';
    }
  }

  positionPopup() {
    const inputRect = this.currentInput.getBoundingClientRect();
    const x = inputRect.left + inputRect.width;
    const y = inputRect.top;
    this.popup.style.display = 'grid';
    this.popup.style.left = `${x}px`;
    this.popup.style.top = `${y}px`;
  }
}

//  ******

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new EmpathyDetector();
  });
} else {
  new EmpathyDetector();
}

function isTextInput(el) {
  const tagName = el.tagName.toLowerCase();
  // maybe for <input :  autocomplete="on"  autocorrect="on" spellcheck="false"
  return tagName === 'textarea' || el.contentEditable === 'true';
}

function getTextContent(el) {
  return el.value || el.textContent || el.innerText;
}

//  ******

async function promptLLM(text, signal) {
  const systemPrompt =
    'You are a mindful communication guide & teacher. You help people be more mindful and compassionate in their communication.';

  const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: systemPrompt,
      },
    ],
    signal,
  });

  return session.prompt(promptTemplate(text));
}

// 1. is this a factual input of information into a html input or web form? (Y/N)
const promptTemplate = (text) => `
Analyze this text and rate the tone in terms of empathy, kindness, and politeness. 

Answer these questions in the exact numbered format shown:

1. is this a communication? e.g. message, comment, review or email (Y/N)
2. give a score from 0 to 9 for tone, where 0 is rude, 9 is polite
3. give a score from 0 to 9 for sentiment, where 0 is negative, 9 is positive
4. give a score from 0-9 for empathy & kindness, where 9 is best

Required format (answer with true / false or numbers only):
1. Y
2. 6
3. 7
4. 5

Only provide the 5 numbered lines exactly as shown in the example as your response will be processed automatically.

**Text to analyze:**
\`\`\`
${text}
\`\`\`
`;

function parseResp(resp) {
  const lines = resp.split('\n');
  const values = {};
  lines.forEach((line) => {
    const chars = line.split('');
    const isrow = chars[1] === '.' && chars[2] === ' ';
    if (!isrow) return null;

    values[chars[0]] = chars[3];
  });

  return {
    // input: values['1'] == 'N',
    message: values['1'] == 'Y',
    tone: parseInt(values['2']),
    sentiment: parseInt(values['3']),
    empathy: parseInt(values['4']),
  };
}

/*
  Examples:
  GREEN "Kind"
  YELLOW "How might you say this to a friend?"
  GREEN "Gentle & understanding"
  RED "Do I sense some frustration?"
  YELLOW "Can we phrase this even more gently?"
  RED "That might be a strong reaction"
  YELLOW "What would you say to them in person?"
  GREEN "This feels caring"
  RED "How might this feel to receive?"
*/

const colours = {
  green: '#43b022ff',
  yellow: '#ffc562ff',
  red: '#ef4444',
};
