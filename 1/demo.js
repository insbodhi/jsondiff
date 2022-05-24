(function demo() {
  const getExampleJson = function() {
    const leftJson = {

        a:2
    }

    const rightJson = {
      
        a:3
    }
    let json = [];

   
    json.push(JSON.stringify(leftJson, null, 2));
    json.push(JSON.stringify(rightJson, null, 2));

    return json;
  };

  /* global jsondiffpatch */
  const instance = jsondiffpatch.create({
    objectHash: function(obj, index) {
      if (typeof obj._id !== 'undefined') {
        return obj._id;
      }
      if (typeof obj.id !== 'undefined') {
        return obj.id;
      }
      if (typeof obj.name !== 'undefined') {
        return obj.name;
      }
      return '$$index:' + index;
    },
  });

  const dom = {
    addClass: function(el, className) {
      if (el.classList) {
        el.classList.add(className);
      } else {
        el.className += ' ' + className;
      }
    },
    removeClass: function(el, className) {
      if (el.classList) {
        el.classList.remove(className);
      } else {
        el.className = el.className.replace(
          new RegExp(
            '(^|\\b)' + className.split(' ').join('|') + '(\\b|$)',
            'gi'
          ),
          ' '
        );
      }
    },
    text: function(el, text) {
      if (typeof el.textContent !== 'undefined') {
        if (typeof text === 'undefined') {
          return el.textContent;
        }
        el.textContent = text;
      } else {
        if (typeof text === 'undefined') {
          return el.innerText;
        }
        el.innerText = text;
      }
    },
    on: function(el, eventName, handler) {
      if (el.addEventListener) {
        el.addEventListener(eventName, handler);
      } else {
        el.attachEvent('on' + eventName, handler);
      }
    },
    ready: function(fn) {
      if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', fn);
      } else {
        document.attachEvent('onreadystatechange', function() {
          if (document.readyState === 'interactive') {
            fn();
          }
        });
      }
    },
    getJson: function(url, callback) {
      /* global XMLHttpRequest */
      let request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.onreadystatechange = function() {
        if (this.readyState === 4) {
          let data;
          try {
            data = JSON.parse(this.responseText, jsondiffpatch.dateReviver);
          } catch (parseError) {
            // eslint-disable-next-line standard/no-callback-literal
            return callback('parse error: ' + parseError);
          }
          if (this.status >= 200 && this.status < 400) {
            callback(null, data);
          } else {
            callback(new Error('request failed'), data);
          }
        }
      };
      request.send();
      request = null;
    },
    runScriptTags: function(el) {
      let scripts = el.querySelectorAll('script');
      for (let i = 0; i < scripts.length; i++) {
        let s = scripts[i];
        // eslint-disable-next-line no-eval
        eval(s.innerHTML);
      }
    },
  };

  const trim = function(str) {
    return str.replace(/^\s+|\s+$/g, '');
  };

  const JsonArea = function JsonArea(element) {
    this.element = element;
    this.container = element.parentNode;
    const self = this;
    const prettifyButton = this.container.querySelector('.prettyfy');
    if (prettifyButton) {
      dom.on(prettifyButton, 'click', function() {
        self.prettyfy();
      });
    }
  };

  JsonArea.prototype.error = function(err) {
    const errorElement = this.container.querySelector('.error-message');
    if (!err) {
      dom.removeClass(this.container, 'json-error');
      errorElement.innerHTML = '';
      return;
    }
    errorElement.innerHTML = err + '';
    dom.addClass(this.container, 'json-error');
  };

  JsonArea.prototype.getValue = function() {
    if (!this.editor) {
      return this.element.value;
    }
    return this.editor.getValue();
  };

  JsonArea.prototype.parse = function() {
    const txt = trim(this.getValue());
    try {
      this.error(false);
      if (
        /^\d+(.\d+)?(e[+-]?\d+)?$/i.test(txt) ||
        /^(true|false)$/.test(txt) ||
        /^["].*["]$/.test(txt) ||
        /^[{[](.|\n)*[}\]]$/.test(txt)
      ) {
        return JSON.parse(txt, jsondiffpatch.dateReviver);
      }
      return this.getValue();
    } catch (err) {
      this.error(err);
      throw err;
    }
  };

  JsonArea.prototype.setValue = function(value) {
    if (!this.editor) {
      this.element.value = value;
      return;
    }
    this.editor.setValue(value);
  };

  JsonArea.prototype.prettyfy = function() {
    const value = this.parse();
    const prettyJson =
      typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    this.setValue(prettyJson);
  };

  /* global CodeMirror */
  JsonArea.prototype.makeEditor = function(readOnly) {
    if (typeof CodeMirror === 'undefined') {
      return;
    }
    this.editor = CodeMirror.fromTextArea(this.element, {
      mode: 'javascript',
      json: true,
      readOnly: readOnly,
    });
    if (!readOnly) {
      this.editor.on('change', compare);
    }
  };

  const areas = {
    left: new JsonArea(document.getElementById('json-input-left')),
    right: new JsonArea(document.getElementById('json-input-right')),
    delta: new JsonArea(document.getElementById('json-delta')),
  };

  const compare = function() {
    let left, right, error;
    document.getElementById('results').style.display = 'none';
    try {
      left = areas.left.parse();
    } catch (err) {
      error = err;
    }
    try {
      right = areas.right.parse();
    } catch (err) {
      error = err;
    }
    areas.delta.error(false);
    if (error) {
      areas.delta.setValue('');
      return;
    }
    const selectedType = getSelectedDeltaType();
    const visualdiff = document.getElementById('visualdiff');
    try {
      const delta = instance.diff(left, right);

      if (typeof delta === 'undefined') {
        switch (selectedType) {
          case 'visual':
            visualdiff.innerHTML = 'no diff';
            break;
        }
      } else {
        switch (selectedType) {
          case 'visual':
            visualdiff.innerHTML = jsondiffpatch.formatters.html.format(
              delta,
              left
            );
            if (!document.getElementById('showunchanged').checked) {
              jsondiffpatch.formatters.html.hideUnchanged();
            }
            dom.runScriptTags(visualdiff);
            break;
        }
      }
    } catch (err) {
      jsondifflength.innerHTML = '0';
      visualdiff.innerHTML = '';
      annotateddiff.innerHTML = '';
      areas.delta.setValue('');
      areas.delta.error(err);
      if (typeof console !== 'undefined' && console.error) {
        console.error(err);
        console.error(err.stack);
      }
    }
    document.getElementById('results').style.display = '';
  };

  areas.left.makeEditor();
  areas.right.makeEditor();

  dom.on(areas.left.element, 'change', compare);
  dom.on(areas.right.element, 'change', compare);
  dom.on(areas.left.element, 'keyup', compare);
  dom.on(areas.right.element, 'keyup', compare);

  const getSelectedDeltaType = function() {
    return 'visual';
  };
  dom.on(document.getElementById('swap'), 'click', function() {
    let leftValue = areas.left.getValue();
    areas.left.setValue(areas.right.getValue());
    areas.right.setValue(leftValue);
    compare();
  });

  dom.on(document.getElementById('clear'), 'click', function() {
    areas.left.setValue('');
    areas.right.setValue('');
    compare();
  });

  dom.on(document.getElementById('showunchanged'), 'change', function() {
    jsondiffpatch.formatters.html.showUnchanged(
      document.getElementById('showunchanged').checked,
      null,
      800
    );
  });

  dom.ready(function() {
    setTimeout(compare);
  }, 1);

  const load = {};

  load.data = function(dataArg) {
    const data = dataArg || {};
    const leftValue = data.left ? data.left.content || data.left : '';
    areas.left.setValue(leftValue);
    const rightValue = data.right ? data.right.content || data.right : '';
    areas.right.setValue(rightValue);

    dom.text(
      document.getElementById('json-panel-left').querySelector('h2'),
      "left"
    );
    dom.text(
      document.getElementById('json-panel-right').querySelector('h2'),
      "right"
    );

    if (data.error) {
      areas.left.setValue('ERROR LOADING: ' + data.error);
      areas.right.setValue('');
    }
  };
    const exampleJson = getExampleJson();
    load.data({
      left: exampleJson[0],
      right: exampleJson[1],
    });
  
})();
