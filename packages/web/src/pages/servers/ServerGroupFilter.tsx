import { StyledSelect } from '../../components/ui/StyledSelect.js';

interface ServerGroupFilterProps {
  readonly groups: readonly string[];
  readonly value: string;
  readonly onChange: (group: string) => void;
}

export function ServerGroupFilter({ groups, value, onChange }: ServerGroupFilterProps) {
  return (
    <StyledSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">全部分组</option>
      {groups.map((g) => (
        <option key={g} value={g}>{g}</option>
      ))}
    </StyledSelect>
  );
}
