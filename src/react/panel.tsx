// The dropdown panel of the styled <LanguageSelector> (options, search, keyboard, virtualization).
import type { ReactNode } from 'react';
import type { LanguageSelectorProps } from './selector';
import type { SelectorCore } from './selector-core';
import { type LanguageOption, usePanel } from './use-language-selector';

export default function Panel<L extends string>({
  core,
  props,
}: {
  core: SelectorCore<L>;
  props: LanguageSelectorProps<L>;
}): ReactNode {
  const p = usePanel(core);
  const { showFlags, showTranslatedName = true, showCheck = true, badges, texts = {} } = props;
  const { options, virtual } = p;
  const row = (o: LanguageOption<L>, i: number) => (
    <div key={o.locale} className="qt-option" {...p.getOptionProps(o, i)}>
      {showCheck && (
        <span className="qt-check" aria-hidden="true">
          {o.selected ? '✓' : ''}
        </span>
      )}
      {showFlags && o.flag && (
        <span className="qt-flag" aria-hidden="true">
          {o.flag}
        </span>
      )}
      <span className="qt-native" lang={o.locale} dir={o.dir}>
        {o.nativeName}
      </span>
      {showTranslatedName && o.name !== o.nativeName && <span className="qt-name">{o.name}</span>}
      {badges?.[o.locale] && <span className="qt-badge">{badges[o.locale]}</span>}
    </div>
  );
  const group = (label: string, from: number, to?: number) => (
    <div role="group" aria-label={label} className="qt-group">
      <div className="qt-group-label" aria-hidden="true">
        {label}
      </div>
      {options.slice(from, to).map((o, k) => row(o, from + k))}
    </div>
  );

  let list: ReactNode;
  if (virtual)
    list = options.slice(virtual.start, virtual.end).map((o, k) => row(o, virtual.start + k));
  else {
    const split = p.query ? 0 : options.findIndex((o) => !o.suggested);
    list =
      split > 0 ? (
        <>
          {group(texts.suggested ?? 'Suggested', 0, split)}
          {group(texts.all ?? 'All languages', split)}
        </>
      ) : (
        options.map(row)
      );
  }

  return (
    <div className="qt-panel">
      {core.searchable && (
        <input
          {...p.getInputProps()}
          className="qt-search"
          placeholder={texts.searchPlaceholder ?? 'Search…'}
        />
      )}
      <div {...p.getListboxProps()} className="qt-list">
        {list}
      </div>
      {!options.length && (
        <div className="qt-empty" role="status">
          {texts.noResults ?? 'No matches'}
        </div>
      )}
    </div>
  );
}
