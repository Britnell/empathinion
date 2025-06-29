class EmpathyDetector {
  constructor() {
    this.popup = null;
    this.currentInput = null;
    this.bouncer = null;

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

    if (this.bouncer) {
      clearTimeout(this.bouncer);
    }

    const text = getTextContent(el);
    this.bouncer = setTimeout(() => this.call(text, el), 1000);
  }

  async call(text, el) {
    // Show loading state
    if (this.popup) {
      const loadingIndicator = this.popup.querySelector('.loading-indicator');
      if (loadingIndicator) loadingIndicator.style.visibility = 'visible';
    }

    // if (!text.trim()) {
    //   this.removePopup();
    //   return;
    // }

    try {
      const resp = await queryLLM(text);
      this.showPopup(el, resp);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  showPopup(inputElement, resp) {
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

    // update content
    const content = this.popup.querySelector('.empathy-content');

    const color = resp.split(' ')[0];
    const fb = resp.split('"')[1];
    const sentence = fb.split(/[\.\?!]\s+/)[0];
    console.log({ resp, color, fb, sentence });

    content.innerHTML = `
        <p class="empathy-reply">
            <span class="empathy-indicator ${color.toLowerCase()}"></span>
            ${sentence}
        </p>
      `;

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

async function queryLLM(text) {
  const session = await LanguageModel.create({
    initialPrompts: [
      {
        role: 'system',
        content: system2,
      },
    ],
  });

  return await session.prompt(prompt2(text));
}

const system2 =
  'You are a mindful communication guide. Give brief, gentle feedback to help the writer be more mindful and compassionate in their communication.';

const prompt2 = (text) => `
Analyze this text and give short gentle feedback, don't criticise but be kind & compassionate. 

Respond with: COLOR "brief feedback"
colors mean : GREEN (compassionate), YELLOW (could improve), RED (needs attention)

Reply with just once sentence.
For text which is factual, not personal, and has no tone or emotion in it, give an empty response : \`GREEN ""\`. 

Examples:
GREEN "Kind"
GREEN "Gentle and understanding"
GREEN "This feels caring"
GREEN ""

YELLOW "How might you say this to a friend?"
YELLOW "Can we phrase this even more gently?"
YELLOW "How might this land for them?"

RED "Do I sense some frustration?"
RED "That's a strong reaction"
RED "How might this feel to receive?"

**Text to analyze:**
\`\`\`
${text}
\`\`\`
`;

/*

'You are a Buddhist master & teacher. You have spent years studying buddhist texts and meditated to understand them, and free your mind of ego and attachment.';

RED "Could you phrase this differently?"
YELLOW "What if we were more curious than certain?"

*/
