import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base: IconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function PaperclipIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M21 12.5l-8.5 8.5a5.5 5.5 0 1 1-7.78-7.78l8.49-8.49a3.67 3.67 0 1 1 5.19 5.19L9.9 18.42a1.83 1.83 0 0 1-2.59-2.59l7.78-7.78" />
    </svg>
  )
}

export function FileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={2} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={2} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={2} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.5} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.5} {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function SystemIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.5} {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.8} {...props}>
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.7} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base} strokeWidth={1.6} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  )
}
