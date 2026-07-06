/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  sentAt?: string
}

const TestEmail = ({ recipientName, sentAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Holis Wellness — email delivery test</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Holis Wellness</Heading>
        </Section>
        <Section style={content}>
          <Heading as="h2" style={h2}>Email delivery test</Heading>
          <Text style={text}>
            {recipientName ? `Hi ${recipientName},` : 'Hello,'}
          </Text>
          <Text style={text}>
            This is a test message from <strong>notify.spaholis.com</strong> to
            confirm that transactional email delivery is working correctly.
          </Text>
          <Text style={text}>
            If you're reading this in your inbox, everything is set up right.
          </Text>
          {sentAt ? (
            <Text style={muted}>Sent at: {sentAt}</Text>
          ) : null}
        </Section>
        <Section style={footer}>
          <Text style={footerText}>Holis Wellness Center · spaholis.com</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TestEmail,
  subject: 'Holis Wellness — email delivery test',
  displayName: 'Delivery test',
  previewData: { recipientName: 'Team', sentAt: new Date().toISOString() },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', padding: '0' }
const header = { backgroundColor: '#2F2F2F', padding: '24px', textAlign: 'center' as const }
const h1 = { color: '#F5F1EC', fontSize: '22px', margin: 0 }
const content = { padding: '28px', color: '#2F2F2F' }
const h2 = { fontSize: '18px', margin: '0 0 14px' }
const text = { fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px' }
const muted = { fontSize: '12px', color: '#888', margin: '18px 0 0' }
const footer = { backgroundColor: '#f5f1ec', padding: '16px', textAlign: 'center' as const }
const footerText = { fontSize: '12px', color: '#666', margin: 0 }
