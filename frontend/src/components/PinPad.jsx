import React from 'react';

export default function PinPad({ length, disabled, onDigit, onDelete }) {
  return <>
    <div className="kp-pin-dots" role="img" aria-label={`${length} of 4 PIN digits entered`}>
      {[0, 1, 2, 3].map(index => <span key={index} className={index < length ? 'is-filled' : ''} />)}
    </div>
    <div className="kp-pin-keypad" role="group" aria-label="PIN keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit =>
        <button key={digit} type="button" disabled={disabled} onClick={() => onDigit(digit)} aria-label={`Enter ${digit}`}>{digit}</button>)}
      <span aria-hidden="true" />
      <button type="button" disabled={disabled} onClick={() => onDigit('0')} aria-label="Enter 0">0</button>
      <button type="button" disabled={disabled} onClick={onDelete} aria-label="Delete last digit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h12v14H9l-7-7 7-7Zm3 4 6 6m0-6-6 6" /></svg>
      </button>
    </div>
  </>;
}
