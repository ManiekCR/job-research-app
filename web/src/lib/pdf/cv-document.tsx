import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { GeneratedApplication } from "@/app/jobs/[id]/actions";

// Une seule colonne, pas de tableaux ni d'éléments graphiques complexes —
// c'est ce qui rend un CV lisible par un parseur ATS (Applicant Tracking
// System), contrairement à un template à colonnes multiples.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  name: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  headline: { fontSize: 11, color: "#444444", marginBottom: 8 },
  contactRow: { flexDirection: "row", gap: 10, fontSize: 9, color: "#555555", marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    borderBottom: "1pt solid #cccccc",
    paddingBottom: 2,
    textTransform: "uppercase",
  },
  summary: { fontSize: 10, lineHeight: 1.4, marginBottom: 4 },
  experienceBlock: { marginBottom: 10 },
  experienceHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  experienceTitle: { fontSize: 10.5, fontWeight: 700 },
  experienceMeta: { fontSize: 9, color: "#555555" },
  bullet: { fontSize: 9.5, lineHeight: 1.4, marginBottom: 2, paddingLeft: 10 },
  tagRow: { flexDirection: "row", flexWrap: "wrap" },
  tag: {
    fontSize: 9,
    backgroundColor: "#f0f0f0",
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginRight: 4,
    marginBottom: 4,
  },
  educationBlock: { marginBottom: 6 },
  educationTitle: { fontSize: 10, fontWeight: 700 },
});

function formatPeriod(start: string, end: string | null): string {
  return `${start} — ${end ?? "présent"}`;
}

export function CvDocument({ data }: { data: GeneratedApplication }) {
  return (
    <Document title={`CV — ${data.name}`} author={data.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{data.name}</Text>
        <Text style={styles.headline}>{data.headline}</Text>
        <View style={styles.contactRow}>
          <Text>{data.email}</Text>
          <Text>{data.location}</Text>
          <Text>{data.linkedin}</Text>
        </View>

        <Text style={styles.summary}>{data.summary}</Text>

        {data.coreSkills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Compétences clés</Text>
            <View style={styles.tagRow}>
              {data.coreSkills.map((skill) => (
                <Text key={skill} style={styles.tag}>
                  {skill}
                </Text>
              ))}
            </View>
          </>
        )}

        {data.technicalSkills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Compétences techniques</Text>
            <View style={styles.tagRow}>
              {data.technicalSkills.map((skill) => (
                <Text key={skill} style={styles.tag}>
                  {skill}
                </Text>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Expérience</Text>
        {data.experience.map((exp, index) => (
          <View key={index} style={styles.experienceBlock} wrap={false}>
            <View style={styles.experienceHeader}>
              <Text style={styles.experienceTitle}>
                {exp.title} — {exp.company}
              </Text>
              <Text style={styles.experienceMeta}>{formatPeriod(exp.start, exp.end)}</Text>
            </View>
            <Text style={styles.experienceMeta}>{exp.location}</Text>
            {exp.highlights.map((highlight, i) => (
              <Text key={i} style={styles.bullet}>
                • {highlight}
              </Text>
            ))}
          </View>
        ))}

        {data.education.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Formation</Text>
            {data.education.map((edu, index) => (
              <View key={index} style={styles.educationBlock}>
                <Text style={styles.educationTitle}>{edu.title}</Text>
                <Text style={styles.experienceMeta}>
                  {edu.school} — {edu.period}
                </Text>
              </View>
            ))}
          </>
        )}

        {data.languages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Langues</Text>
            <View style={styles.tagRow}>
              {data.languages.map((lang) => (
                <Text key={lang.name} style={styles.tag}>
                  {lang.name} — {lang.level}
                </Text>
              ))}
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}