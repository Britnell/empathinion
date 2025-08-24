class EmpathyDetector {
  constructor() {
    this.popup = null;
    this.currentInput = null;
    this.currentController = null;

    this.init();
  }

  async init() {
    const availability = await LanguageModel.availability();
    console.log({ availability });

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

    if (!isTextInput(el)) return;

    const text = getTextContent(el);

    const resp = await this.query(text);
    if (!resp) return;

    this.renderResp(el, resp);
  }

  async query(text) {
    const abort = new AbortController();
    this.currentController = abort;

    try {
      const resp = await promptLLM(text, abort.signal);
      // if (!abort.signal.aborted)
      return resp;
    } catch {
      // aborted
    }
  }

  renderResp(inputElement, resp) {
    this.currentInput = inputElement;

    const content = this.popup.querySelector('.empathy-content');
    if (!content) {
      return;
    }

    const values = parseResp(resp);
    console.log(values);

    const notmsg = !values.input || !values.message;
    if (notmsg) {
      return;
    }

    const avrg = (values.tone + values.sentiment + values.empathy) / 3;
    if (isNaN(avrg)) {
      return;
    }

    this.positionPopup();
    this.popover.showPopover();

    const col = avrg <= 3.5 ? 'red' : avrg < 6.3 ? 'yellow' : 'green';
    content.style.background = colours[col];
  }

  createPopup() {
    this.popup = document.createElement('div');
    this.popup.innerHTML = `
      <div id="empathiipopup" class="empathy-popup" popover="auto">
        <button class="empathy-close" popovertarget="empathiipopup" popovertargetaction="hide">&times;</button>
        <div class="empathy-content"></div>
        <span>(e)</span>
      </div>  `;
    document.body.appendChild(this.popup);

    this.popover = this.popup.querySelector('.empathy-popup');

    this.popup.querySelector('.empathy-close').addEventListener('click', () => {
      this.popover.hidePopover();
    });
  }

  removePopup() {
    if (!this.popup) {
      return;
    }

    this.popup.parentNode.removeChild(this.popup);
    this.popup = null;
    this.currentInput = null;
  }

  positionPopup() {
    // place this.popup rel to this.currentInput
    // this.currentInput.style.anchorName = '--empathii-anchor';
    // this.popover.style.left = 'anchor(--empathii-anchor right)';
    // this.popover.style.top = 'anchor(--empathii-anchor top)';
  }

  // *
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

const promptTemplate = (text) => `
Analyze this text and rate the tone in terms of empathy, kindness, and politeness. 

Answer these questions in the exact numbered format shown:

1. is this a factual input of information into a html input or web form? (Y/N)
2. is this a communication? e.g. message, comment, review or email (Y/N)
3. give a score from 0 to 9 for tone, where 0 is rude, 9 is polite
4. give a score from 0 to 9 for sentiment, where 0 is negative, 9 is positive
5. give a score from 0-9 for empathy & kindness, where 9 is best

Required format (answer with true / false or numbers only):
1. N
2. Y
3. 6
4. 7
5. 5

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
    input: values['1'] == 'N',
    message: values['2'] == 'Y',
    tone: parseInt(values['3']),
    sentiment: parseInt(values['4']),
    empathy: parseInt(values['5']),
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
