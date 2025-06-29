class EmpathyDetector {
  constructor() {
    this.popup = null;
    this.currentInput = null;
    this.currentController = null;

    this.init();
  }

  async init() {
    const availability = await LanguageModel.availability();
    if (availability) {
      document.addEventListener('input', this.handleInput.bind(this));
    }
  }

  handleInput(event) {
    const el = event.target;

    if (!isTextInput(el)) {
      return;
    }

    if (this.currentController) {
      this.currentController.abort();
    }

    const text = getTextContent(el);
    this.call(text, el);
  }

  async call(text, el) {
    this.currentController = new AbortController();
    const signal = this.currentController.signal;

    if (this.popup) {
      const loadingIndicator = this.popup.querySelector('.loading-indicator');
      if (loadingIndicator) loadingIndicator.style.visibility = 'visible';
    }

    try {
      const resp = await queryLLM(text, signal);

      if (!signal.aborted) {
        this.showPopup(el, resp);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  showPopup(inputElement, resp) {
    if (this.currentInput !== inputElement && this.popup) {
      this.positionPopup();
    }
    this.currentInput = inputElement;

    if (!this.popup) {
      this.popup = document.createElement('div');
      this.popup.className = 'empathy-popup';
      this.popup.innerHTML = `
        
        <div>
            <div class="empathy-header">
                <span>Empathy Analysis</span>  
                <div class="loading-indicator"></div>
                <button class="empathy-close">&times;</button>
            </div>
            <div class="empathy-content"></div>
        </div>`;

      const closeButton = this.popup.querySelector('.empathy-close');
      closeButton.addEventListener('click', () => this.removePopup());
      document.body.appendChild(this.popup);
      this.positionPopup();
    }

    const content = this.popup.querySelector('.empathy-content');

    const color = resp.split(' ')[0];
    const fb = resp.split('"')[1];
    const sentence = fb.split(/[\.\?!]\s+/)[0];

    if (color && sentence)
      content.innerHTML = `
        <p class="empathy-reply">
            <span class="empathy-indicator ${color.toLowerCase()}"></span>
            ${sentence}
        </p>
      `;
    else content.innerHTML = 'X';

    if (this.popup) {
      const loadingIndicator = this.popup.querySelector('.loading-indicator');
      if (loadingIndicator) loadingIndicator.style.visibility = 'hidden';
    }
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
    if (!this.popup || !this.currentInput) return;

    const rect = this.currentInput.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

    const right = viewportWidth - rect.right - window.scrollX;
    const top = rect.bottom + window.scrollY + 5;

    const popupWidth = 300;
    const minRight = Math.max(right, 10);

    this.popup.style.cssText = `
      position: absolute;
      top: ${top}px;
      right: ${minRight}px;
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

function extractJSON(resp) {
  const firstBrace = resp.indexOf('{');
  const lastBrace = resp.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) return null;

  try {
    return JSON.parse(resp.slice(firstBrace, lastBrace + 1));
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

async function queryLLM(text, signal) {
  const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: system2,
      },
    ],
    signal: signal,
  });

  return session.prompt(prompt2(text));
}

const system2 =
  'You are a mindful communication guide & teacher. You help people be more mindful and compassionate in their communication.';

const prompt2 = (text) => `
Analyze this text and rate the tone in terms of empathy, kindness, and politeness. Don't give feedback, just rate the tone and suggest when more empathy is needed. 
Keep responses to one sentence.

Respond with: \`COLOR "single sentence reply."\`
use colors : GREEN (good), YELLOW (could be better), RED (negative)
For an factual, non-personal text with no emotional tone, give an empty reply \`GREEN ""\`

Examples:
GREEN "Kind"
GREEN "Gentle & understanding"
GREEN "This feels caring"
GREEN ""

YELLOW "How might you say this to a friend?"
YELLOW "Can we phrase this even more gently?"
YELLOW "What would you say to them in person?"

RED "Do I sense some frustration?"
RED "That might be a strong reaction"
RED "How might this feel to receive?"

**Text to analyze:**
\`\`\`
${text}
\`\`\`
`;
