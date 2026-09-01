import React, {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
  ChangeEvent,
} from 'react';
import TerminalInput from './linetypes/TerminalInput';
import TerminalOutput from './linetypes/TerminalOutput';
import './style.css';

export enum ColorMode {
  Light,
  Dark,
}

function Terminal({
  name,
  prompt,
  height = '600px',
  colorMode,
  onInput,
  children,
  startingInputValue = '',
  scrollToPosition = true,
}: any) {
  const [currentLineInput, setCurrentLineInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursorPos, setCursorPos] = useState(0);

  const scrollIntoViewRef = useRef<HTMLDivElement>(null);

  // Calculates the total width in pixels of the characters to the right of the cursor.
  // Create a temporary span element to measure the width of the characters.
  const calculateInputWidth = (
    inputElement: HTMLInputElement,
    chars: string,
  ) => {
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.fontSize = window.getComputedStyle(inputElement).fontSize;
    span.style.fontFamily = window.getComputedStyle(inputElement).fontFamily;
    span.innerText = chars;
    document.body.appendChild(span);
    const { width } = span.getBoundingClientRect();
    document.body.removeChild(span);
    // Return the negative width, since the cursor position is to the left of the input suffix
    return -width;
  };

  useEffect(() => {
    const onReceiveAutocompleteResults = (
      filesNames: string[],
      searchedInput: string,
    ) => {
      if (filesNames && filesNames.length > 0) {
        const newCurrentLineInput = currentLineInput.replace(
          searchedInput,
          `${filesNames[0]} `,
        );
        setCurrentLineInput(newCurrentLineInput);
        setCursorPos(0);
      }
      const terminalInput = document.getElementsByClassName(
        'terminal-hidden-input',
      );
      if (terminalInput.length > 0) {
        const terminalInputElement = terminalInput[0] as any;
        terminalInputElement.focus();
      }
    };

    window.electron.ipcRenderer.on('autocomplete-results', onReceiveAutocompleteResults);

    return () => {
      window.electron.ipcRenderer.removeAllListeners('autocomplete-results');
    };
  }, [currentLineInput]);

  const updateCurrentLineInput = (event: ChangeEvent<HTMLInputElement>) => {
    setCurrentLineInput(event.target.value);
  };

  const clamp = (value: number, min: number, max: number) => {
    if (value > max) return max;
    if (value < min) return min;
    return value;
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!onInput) {
      return;
    }
    if (event.key === 'Tab') {
      if (currentLineInput && currentLineInput.trim() !== '') {
        const splitted = currentLineInput.split(' ');
        const lastWord = splitted[splitted.length - 1];
        window.electron.ipcRenderer.send('autocomplete', name, lastWord);
      }
    }
    if (event.key === 'Enter') {
      onInput(currentLineInput);
      if (currentLineInput.trim() !== '') {
        setHistory([currentLineInput, ...history]);
      }
      setCursorPos(0);
      setCurrentLineInput('');
      if (scrollToPosition) {
        setTimeout(
          () =>
            scrollIntoViewRef?.current?.scrollIntoView({
              behavior: 'auto',
              block: 'nearest',
            }),
          500,
        );
      }
    } else if (event.ctrlKey && event.key === 'u') {
      setCurrentLineInput('');
    } else if (
      ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Delete'].includes(
        event.key,
      )
    ) {
      const inputElement = event.currentTarget;
      let charsToRightOfCursor = '';
      let cursorIndex =
        currentLineInput.length - (inputElement.selectionStart || 0);
      cursorIndex = clamp(cursorIndex, 0, currentLineInput.length);

      if (event.key === 'ArrowLeft') {
        if (cursorIndex > currentLineInput.length - 1) {
          cursorIndex -= 1;
        }
        charsToRightOfCursor = currentLineInput.slice(
          currentLineInput.length - 1 - cursorIndex,
        );
      } else if (event.key === 'ArrowRight' || event.key === 'Delete') {
        charsToRightOfCursor = currentLineInput.slice(
          currentLineInput.length - cursorIndex + 1,
        );
      } else if (event.key === 'ArrowUp') {
        if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setCurrentLineInput(history[historyIndex - 1]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setCurrentLineInput('');
        }
      } else if (event.key === 'ArrowDown') {
        if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setCurrentLineInput(history[historyIndex + 1]);
        } else if (historyIndex === history.length - 1) {
          setHistoryIndex(-1);
          setCurrentLineInput('');
        }
      }

      const inputWidth = calculateInputWidth(
        inputElement,
        charsToRightOfCursor,
      );
      setCursorPos(inputWidth);
    } else if (event.key === 'Home') {
      const inputElement = event.currentTarget;
      setCursorPos(calculateInputWidth(inputElement, currentLineInput));
    } else if (event.key === 'End') {
      const inputElement = event.currentTarget;
      setCursorPos(calculateInputWidth(inputElement, ''));
    }
  };

  useEffect(() => {
    setCurrentLineInput(startingInputValue.trim());
  }, [startingInputValue]);

  // We use a hidden input to capture terminal input; make sure the hidden input is focused when clicking anywhere on the terminal
  useEffect(() => {
    if (onInput == null) {
      return;
    }
    // keep reference to listeners so we can perform cleanup
    const elListeners: {
      terminalEl: Element;
      listener: any;
    }[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const terminalEl of document.getElementsByClassName(
      'react-terminal-wrapper',
    )) {
      const listener = () =>
        (
          terminalEl?.querySelector('.terminal-hidden-input') as HTMLElement
        )?.focus();
      terminalEl?.addEventListener('click', listener);
      elListeners.push({ terminalEl, listener });
    }
    // eslint-disable-next-line consistent-return
    return function cleanup() {
      elListeners.forEach((elListener) => {
        elListener.terminalEl.removeEventListener('click', elListener.listener);
      });
    };
  }, [onInput]);

  const classes = ['react-terminal-wrapper'];
  if (colorMode === ColorMode.Light) {
    classes.push('react-terminal-light');
  }
  return (
    <div className={classes.join(' ')} data-terminal-name={name}>
      <div className="react-terminal" style={{ height }}>
        {children}
        {typeof onInput === 'function' && (
          <div
            className="react-terminal-line react-terminal-input react-terminal-active-input"
            data-terminal-prompt={prompt || '$'}
            key="terminal-line-prompt"
          >
            {currentLineInput}
            <span className="cursor" style={{ left: `${cursorPos + 1}px` }} />
          </div>
        )}
        <div ref={scrollIntoViewRef} />
      </div>
      <input
        className="terminal-hidden-input"
        placeholder="Terminal Hidden Input"
        value={currentLineInput}
        autoFocus={onInput != null}
        onChange={updateCurrentLineInput}
        onKeyDown={handleInputKeyDown}
      />
    </div>
  );
}

export { TerminalInput, TerminalOutput };
export default Terminal;
