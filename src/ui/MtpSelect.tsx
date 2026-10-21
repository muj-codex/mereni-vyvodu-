import { useState } from 'react';
import { MTP_OPTIONS } from '../core/config';
import { VN_MTP } from '../core/current';
import { formatNumber } from '../core/numbers';
import { parseNumber } from '../core/numbers';
import { Field, SelectField } from './Fields';
export function MtpSelect({
  label,
  secondary = 5,
  value,
  onChange,
}: {
  label: string;
  secondary?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState(String(value));
  const options: readonly number[] = secondary === 1 ? VN_MTP : MTP_OPTIONS;
  const isCustom = custom || !options.some((option) => option === value);
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
        {options.map((v) => (
          <option key={v} value={v}>
            {formatNumber(v)}/{secondary} A
          </option>
        ))}
        <option value="custom">VLASTNÍ MTP</option>
      </SelectField>
      {isCustom && (
        <p>
          {formatNumber(value)}/{secondary} A
        </p>
      )}
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
