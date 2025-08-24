window.log.textContent = 'abc<br>';

run();

async function run() {
  const availability = await LanguageModel.availability();
  window.log.textContent += 'Model availability:' + availability + '<br>';
}

async function downloadModel() {
  console.log('dd');

  const session = await LanguageModel.create({
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        window.log.textContent += `Downloaded ${e.loaded * 100}%` + '<br>';
      });
    },
  });
}
