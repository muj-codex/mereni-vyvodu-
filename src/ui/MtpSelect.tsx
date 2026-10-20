import { useState } from 'react';
import { MTP_OPTIONS } from '../core/config';
import { parseNumber } from '../core/numbers';
import { Field, SelectField } from './Fields';
export function MtpSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState(String(value));
  const isCustom = custom || !MTP_OPTIONS.some((option) => option === value);
  return (
    <>
      <SelectField
        label={label}
        value={isCustom ? 'custom' : value}
        onChange={(v) => {
          setCustom(v === 'custom');
          if (v === 'custom') setText(String(value));
          else onChange(Number(v));
        }}
      >
        {MTP_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {v}/5 A
          </option>
        ))}
        <option value="custom">VLASTNÍ MTP</option>
      </SelectField>
      {isCustom && <p>{Number.isFinite(value) ? String(value).replace('.', ',') : '—'}/5 A</p>}
      {isCustom && (
        <Field
          label={`${label} – vlastní primár (A)`}
          value={text}
          onChange={(v) => {
            setText(v);
            onChange(parseNumber(v));
          }}
        />
      )}
    </>
  );
}
