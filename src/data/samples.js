import sampleSteveJobs from './sampleSteveJobs.json';
import sampleHuberman from './sampleHuberman.json';
import sampleJoeRogan from './sampleJoeRogan.json';
import sampleRickAstley from './sampleRickAstley.json';

export const SAMPLE_PODCASTS = [
  {
    id: 'UF8uR6Z6KLc',
    title: 'Steve Jobs',
    topic: 'Stanford Commencement Address',
    url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
    transcriptSegments: sampleSteveJobs
  },
  {
    id: 'lIo9FcrljDk',
    title: 'Huberman Lab',
    topic: 'Master Your Sleep & Alertness',
    url: 'https://www.youtube.com/watch?v=lIo9FcrljDk',
    transcriptSegments: sampleHuberman
  },
  {
    id: 'sSOxPJD-VNo',
    title: 'Joe Rogan',
    topic: 'Elon Musk on Technology (#2281)',
    url: 'https://www.youtube.com/watch?v=sSOxPJD-VNo',
    transcriptSegments: sampleJoeRogan
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Rick Astley',
    topic: 'Never Gonna Give You Up',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    transcriptSegments: sampleRickAstley
  }
];
