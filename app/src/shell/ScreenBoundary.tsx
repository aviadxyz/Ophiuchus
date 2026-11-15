import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '@/design'

type ScreenBoundaryProps = { children: ReactNode; label?: string }
type ScreenBoundaryState = { failed: boolean }

/** Wraps one screen. A crash shows an error card with a reload button; the shell keeps working. */
export class ScreenBoundary extends Component<ScreenBoundaryProps, ScreenBoundaryState> {
  state: ScreenBoundaryState = { failed: false }

  static getDerivedStateFromError(): ScreenBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Only the error type and where it happened. Never the message, which could hold a reading.
    if (import.meta.env.DEV) console.error(`Screen crashed: ${error.name}`, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert">
        <Card
          title={
            this.props.label
              ? `${this.props.label} could not be shown`
              : 'This screen could not be shown'
          }
          footer={<Button onClick={() => window.location.reload()}>Reload</Button>}
        >
          Something went wrong while showing this screen. The rest of the console still works.
          Reload to try again, or pick another screen from the menu.
        </Card>
      </div>
    )
  }
}
