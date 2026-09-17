'use client';
import * as React from 'react';
import { Icon } from './icon';
import { formatPrice } from '../lib/core.mjs';
export function Price({ value, from = false, large = false }: {
    value: number;
    from?: boolean;
    large?: boolean;
}) {
    return <span className={`price ${large ? 'price-large' : ''}`}>{from && <small>يبدأ من</small>}<b dir="ltr">{formatPrice(value)}</b><small>د.ع</small></span>;
}
export function Quantity({ value, onChange, label = 'الكمية' }: {
    value: number;
    onChange: (n: number) => void;
    label?: string;
}) {
    return <div className="quantity" role="group" aria-label={label}>
   <button type="button" aria-label={`زيادة ${label}`} disabled={value >= 99} onClick={() => onChange(value + 1)}><Icon name="plus" size={13}/></button>
   <span className="quantity-number" aria-live="polite" dir="ltr">{value}</span>
   <button type="button" aria-label={`تقليل ${label}`} disabled={value <= 1} onClick={() => onChange(value - 1)}><Icon name="minus" size={13}/></button>
 </div>;
}
/** Native modal dialogs provide focus containment, Escape handling, and inert background. */
export class Modal extends React.Component<{
    children: React.ReactNode;
    onClose: () => void;
    className?: string;
    labelledBy: string;
}> {
    private dialog: HTMLDialogElement | null = null;
    private lastFocus: HTMLElement | null = null;
    private previousOverflow = '';
    private cancel = (event: Event) => { event.preventDefault(); this.props.onClose(); };
    private trapTab = (event: KeyboardEvent) => {
        if (event.key !== 'Tab' || !this.dialog)
            return;
        const candidates = Array.from(this.dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(el => el.getClientRects().length > 0);
        const first = candidates[0], last = candidates[candidates.length - 1];
        if (!first) {
            event.preventDefault();
            return;
        }
        if (event.shiftKey && (document.activeElement === first || document.activeElement?.hasAttribute('data-dialog-heading'))) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    componentDidMount() {
        this.lastFocus = document.activeElement as HTMLElement;
        this.previousOverflow = document.body.style.overflow;
        this.dialog?.addEventListener('cancel', this.cancel);
        this.dialog?.addEventListener('keydown', this.trapTab);
        this.dialog?.showModal();
        document.body.style.overflow = 'hidden';
        // Focus the heading, not a text field: don't unnecessarily open mobile keyboards.
        this.dialog?.querySelector<HTMLElement>('[data-dialog-heading]')?.focus();
    }
    componentWillUnmount() { this.dialog?.removeEventListener('cancel', this.cancel); this.dialog?.removeEventListener('keydown', this.trapTab); this.dialog?.close(); document.body.style.overflow = this.previousOverflow; this.lastFocus?.focus({ preventScroll: true }); }
    render() {
        return <dialog ref={el => { this.dialog = el; }} className={`modal ${this.props.className || ''}`} aria-labelledby={this.props.labelledBy} onClick={e => { if (e.target === e.currentTarget) {
            const r = e.currentTarget.getBoundingClientRect();
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
                this.props.onClose();
        } }}>
   {this.props.children}
 </dialog>;
    }
}
export function EmptyState({ icon = 'bag', title, children }: {
    icon?: string;
    title: string;
    children: React.ReactNode;
}) {
    return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={31}/></span><h3>{title}</h3><div>{children}</div></div>;
}
