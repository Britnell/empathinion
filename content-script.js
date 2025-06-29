console.log('Empathy detector loaded!');

const systemPrompt =
  'You are a wise teacher who understands compassionate communication. Analyze text for empathy, kindness, and emotional awareness as a mindful observer would.';

const prompt = (text) => `
Analyze the following text for emotional tone and empathy level. Start with a brief overall summary and analysis, then output scores in JSON format.

**Scoring Guidelines:**
- **Empathy (1-10):** 1 = No consideration for others' feelings, 10 = Highly empathetic and understanding
- **Politeness (1-10):** 1 = Very rude/harsh, 10 = Extremely courteous and respectful  
- **Anger (1-10):** 1 = No anger detected, 10 = Extremely angry/hostile
- **Condescension (1-10):** 1 = No condescending tone, 10 = Highly condescending/patronizing
- **Emotional Regulation (1-10):** 1 = Poor emotional control, 10 = Excellent emotional control

**JSON Format example:**
{
    "empathy": 5,
    "politeness": 6,
    "anger": 2,
    "condescension": 1,
    "emotional_regulation": 8,
}

**Text to analyze:**
\`\`\`
${text}
\`\`\`

Focus on how the text might be received by others, not just the sender's intent.
`;

class EmpathyDetector {
  constructor() {
    this.popup = null;
    this.currentInput = null;
    this.bouncer = null;
    this.init();
  }

  async init() {
    // Listen for input events on the entire page
    document.addEventListener('input', this.handleInput.bind(this));
    // document.addEventListener('focusin', this.handleFocus.bind(this));

    const params = await LanguageModel.params();
    const availability = await LanguageModel.availability();
    console.log('// READY ', { params, availability });
  }

  handleInput(event) {
    const el = event.target;

    if (!isTextInput(el)) {
      return;
    }

    if (this.bouncer) {
      clearTimeout(this.bouncer);
    }

    const text = getTextContent(el);
    this.bouncer = setTimeout(() => this.call(text, el), 1000);
  }

  async call(text, el) {
    console.log('// ' + text);

    // if (!text.trim()) {
    //   this.removePopup();
    //   return;
    // }

    try {
      const res = await queryLLM(text);
      const analysis = extractJSON(res);
      console.log(analysis);

      if (!analysis) {
        return;
      }
      this.showPopup(el, analysis);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  showPopup(inputElement, analysis = null) {
    //  reposition
    if (this.currentInput !== inputElement && this.popup) {
      this.positionPopup();
    }
    this.currentInput = inputElement;

    //  Create
    if (!this.popup) {
      this.popup = document.createElement('div');
      this.popup.className = 'empathy-popup';
      this.popup.innerHTML = `
            <button class="empathy-close">&times;</button>
            <div class="empathy-content"></div>`;

      const closeButton = this.popup.querySelector('.empathy-close');
      closeButton.addEventListener('click', () => this.removePopup());
      document.body.appendChild(this.popup);
      this.positionPopup();
    }

    // update content
    const content = this.popup.querySelector('.empathy-content');
    content.innerHTML = `
        <div class="empathy-header">Empathy Analysis</div>
        <ul class="empathy-scores">
          <li>Empathy: ${analysis.empathy}</li>
          <li>Politeness: ${analysis.politeness}</li>
          <li>Anger: ${analysis.anger}</li>
          <li>Condescension: ${analysis.condescension}</li>
          <li>Emotional Regulation: ${analysis.emotional_regulation}</li>
        </ul>
      `;

    // this.autoRemoveTimer = setTimeout(() => this.removePopup(), 10000);
  }

  removePopup() {
    if (!this.popup) {
      return;
    }

    this.popup.parentNode.removeChild(this.popup);
    this.popup = null;
    this.currentInput = null;
    // if (this.autoRemoveTimer) {
    //   clearTimeout(this.autoRemoveTimer);
    //   this.autoRemoveTimer = null;
    // }
  }

  positionPopup() {
    if (!this.popup || !this.currentInput) return;

    const rect = this.currentInput.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 5;

    const popupWidth = 300;
    if (left + popupWidth > viewportWidth) {
      left = Math.max(10, viewportWidth - popupWidth - 10);
    }

    this.popup.style.cssText = `
      position: absolute;
      top: ${top}px;
      left: ${left}px;
      z-index: 10000;
    `;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new EmpathyDetector();
  });
} else {
  new EmpathyDetector();
}

function extractJSON(response) {
  const firstBrace = response.indexOf('{');
  const lastBrace = response.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) return null;

  try {
    return JSON.parse(response.slice(firstBrace, lastBrace + 1));
  } catch (e) {
    return null;
  }
}

function isTextInput(el) {
  const tagName = el.tagName.toLowerCase();
  return tagName === 'textarea' || (tagName === 'input' && el.type === 'text') || el.contentEditable === 'true';
}

function getTextContent(el) {
  return el.value || el.textContent || el.innerText;
}

async function queryLLM(text) {
  const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: systemPrompt,
      },
    ],
  });

  const res = await session.prompt(prompt(text));
  return res;
}
