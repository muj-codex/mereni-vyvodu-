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
  empty = false,
}: {
  label: string;
  secondary?: number;
  value: number;
  empty?: boolean;
  onChange: (value: number) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState(empty ? '' : String(value));
  const options: readonly number[] = secondary === 1 ? VN_MTP : MTP_OPTIONS;
  const isCustom = custom || (!empty && !options.some((option) => option === value));
  return (
    <>
      <SelectField
        label={label}
        value={isCustom ? 'custom' : empty ? '' : value}
        onChange={(v) => {
          setCustom(v === 'custom');
          if (v === 'custom') setText(empty ? '' : String(value));
          else onChange(v === '' ? NaN : Number(v));
        }}
      >
        {empty && <option value="">Vyberte MTP primární</option>}
        {options.map((v) => (
          <option key={v} value={v}>
            {formatNumber(v)}/{secondary} A
          </option>
        ))}
        <option value="custom">VLASTNÍ MTP</option>
      </SelectField>
      {isCustom && !empty && (
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
