import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { GeneratedApplication } from "@/app/jobs/[id]/actions";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", color: "#1a1a1a", lineHeight: 1.5 },
  senderBlock: { marginBottom: 24 },
  name: { fontSize: 13, fontWeight: 700 },
  contact: { fontSize: 9.5, color: "#555555" },
  date: { marginBottom: 16, fontSize: 10 },
  recipient: { marginBottom: 16, fontSize: 10 },
  paragraph: { marginBottom: 10 },
});

export function CoverLetterDocument({ data }: { data: GeneratedApplication }) {
  const paragraphs = data.coverLetter.split("\n\n").filter(Boolean);
  const today = new Date().toLocaleDateString("fr-FR");

  return (
    <Document title={`Lettre de motivation — ${data.companyName}`} author={data.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.senderBlock}>
          <Text style={styles.name}>{data.name}</Text>
          <Text style={styles.contact}>{data.email}</Text>
          <Text style={styles.contact}>{data.location}</Text>
          <Text style={styles.contact}>{data.linkedin}</Text>
        </View>

        <Text style={styles.date}>{today}</Text>
        <Text style={styles.recipient}>
          {data.companyName} — {data.jobTitle}
        </Text>

        {paragraphs.map((paragraph, i) => (
          <Text key={i} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </Page>
    </Document>
  );
}