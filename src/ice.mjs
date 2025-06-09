export default class Ice {
  constructor(element, options = {}) {
    this.element = element;
    this.options = options;
    // Mark the element as being managed by Ice
    element.dataset.iceUser = options.username || '';
    // Simple highlighting to show change
    element.addEventListener('input', () => {
      element.style.backgroundColor = '#fff9c4';
    });
  }
}
