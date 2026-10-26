type SourceRow = { id: string; time: number; text: string };

type SampleStory = {
  name: string;
  initials: string;
  role: string;
  tag: string;
  group: string;
  chapter: string;
  subtitle: string;
  question: string;
  answer: string;
  time: number;
  evidence: string;
  transcript: readonly SourceRow[];
};

export const sampleStories: readonly SampleStory[] = [
  {
    name: "Northwind Labs",
    initials: "AW",
    role: "AWS · Networking · prod",
    tag: "THE SURPRISE SPIKE",
    group: "AWS · Networking",
    chapter: "AWS · Networking",
    subtitle: "A new service was reaching S3 through a NAT Gateway.",
    question: "Why did data transfer cost jump 4x last Tuesday?",
    answer:
      "Data transfer rose from $46 to $184 a week after a new service began sending S3 traffic through a NAT Gateway in us-east-1. The service launched on Tuesday. Processing 4.1 TB through the gateway accounts for the increase. Routing that traffic through a VPC endpoint removes the NAT charge.",
    time: 9,
    evidence:
      "Cost Explorer · us-east-1 · NAT Gateway · 4.1 TB processed · $184.00 this month · [1]",
    transcript: [
      {
        id: "net-1",
        time: 0,
        text: "Cost Explorer · us-east-1 · data transfer · week of 6 October: $46.00.",
      },
      {
        id: "net-2",
        time: 9,
        text: "Cost Explorer · us-east-1 · NAT Gateway · week of 13 October: $184.00. New service launched Tuesday.",
      },
      {
        id: "net-3",
        time: 18,
        text: "Usage type · NatGateway-Bytes · 4.1 TB processed · list price applied.",
      },
    ],
  },
  {
    name: "Northwind Labs",
    initials: "AZ",
    role: "Azure · Compute · staging",
    tag: "FORGOTTEN RESOURCES",
    group: "Azure · Compute",
    chapter: "Azure · Compute · Coming soon",
    subtitle: "Unattached disks, idle load balancers, a staging cluster running since March.",
    question: "What are we paying for that nobody uses?",
    answer:
      "Three unattached disks, two idle load balancers and one staging cluster have run since March. The cluster has a 30-day average CPU under 2%. Together they cost $612 a month. The cluster is the largest item at $430; the disks and load balancers make up the rest.",
    time: 9,
    evidence:
      "Resource metadata · Northwind Labs, staging · 1 cluster · 3 disks · 2 load balancers · 30-day window · [2]",
    transcript: [
      {
        id: "idle-1",
        time: 0,
        text: "Azure · staging · cluster-03 · running since 2 March · 30-day average CPU 1.8%.",
      },
      {
        id: "idle-2",
        time: 9,
        text: "Azure · staging · 3 unattached managed disks · 2 load balancers with zero backend traffic.",
      },
      {
        id: "idle-3",
        time: 18,
        text: "Estimated monthly cost · $612.00 · list pricing · savings are estimates.",
      },
    ],
  },
  {
    name: "Northwind Labs",
    initials: "AW",
    role: "AWS · Commitments · prod",
    tag: "COMMITMENTS",
    group: "AWS · Commitments",
    chapter: "AWS · Commitments · Coming soon",
    subtitle: "Steady baseline usage, covered at the right size, without overcommitting.",
    question: "Should we buy a Savings Plan or wait?",
    answer:
      "The production baseline is steady at about 62% of current compute spend. A one-year compute Savings Plan sized to that baseline would cover the stable usage without locking in peak capacity. The estimate assumes list pricing; your actual discount may differ.",
    time: 9,
    evidence:
      "Cost Explorer · 90-day compute baseline · 62% steady usage · list pricing · [3]",
    transcript: [
      {
        id: "commit-1",
        time: 0,
        text: "Cost Explorer · 90 completed days · production compute · baseline 62% of hourly spend.",
      },
      {
        id: "commit-2",
        time: 9,
        text: "Peak hours exceed the baseline by 38%. A plan sized to the peak would overcommit.",
      },
      {
        id: "commit-3",
        time: 18,
        text: "Estimate uses list pricing and excludes existing discounts. Confirm before buying.",
      },
    ],
  },
  {
    name: "Northwind Labs",
    initials: "GC",
    role: "Google Cloud · Compute · data",
    tag: "RIGHTSIZING",
    group: "Google Cloud · Compute",
    chapter: "Google Cloud · Compute · Coming soon",
    subtitle: "Fourteen instances under 10% CPU for 30 days.",
    question: "Which VMs are twice as big as they need to be?",
    answer:
      "Fourteen instances averaged under 10% CPU for 30 days. Eleven are n2-standard-8 machines whose 95th-percentile CPU stays under 12%. Moving those eleven to n2-standard-4 would reduce compute cost by about $780 a month. Three instances have memory pressure and need review before any change.",
    time: 9,
    evidence:
      "Monitoring · 30-day window · 14 instances · 95th-percentile CPU 12% · memory 41% · [4]",
    transcript: [
      {
        id: "size-1",
        time: 0,
        text: "Monitoring · 30 completed days · 14 instances · average CPU under 10%.",
      },
      {
        id: "size-2",
        time: 9,
        text: "11 × n2-standard-8 · p95 CPU 12% · memory 41% · resize is a review recommendation.",
      },
      {
        id: "size-3",
        time: 18,
        text: "Estimated saving · $780.00 a month · list pricing · excludes discounts.",
      },
    ],
  },
  {
    name: "Northwind Labs",
    initials: "AI",
    role: "LLM APIs · Usage · product",
    tag: "AI SPEND",
    group: "LLM APIs · Usage",
    chapter: "LLM APIs · Usage · Coming soon",
    subtitle: "Token spend by model, team and feature.",
    question: "Which team's model usage doubled this month?",
    answer:
      "Product's model spend doubled from $310 to $640 this month. Two features account for 78% of the increase: summarisation and in-app search. Input tokens rose 2.1x while output tokens rose 1.3x, which points to longer prompts rather than more users.",
    time: 9,
    evidence:
      "Usage export · product team · input 2.1x · output 1.3x · $640 this month · [5]",
    transcript: [
      {
        id: "ai-1",
        time: 0,
        text: "Usage export · product team · last month $310.00 · this month $640.00.",
      },
      {
        id: "ai-2",
        time: 9,
        text: "Summarisation 46% of increase · in-app search 32% · input tokens 2.1x · output 1.3x.",
      },
      {
        id: "ai-3",
        time: 18,
        text: "Token counts come from the provider export. Prices are applied in code.",
      },
    ],
  },
  {
    name: "Northwind Labs",
    initials: "K8",
    role: "Kubernetes · Workloads · platform",
    tag: "KUBERNETES",
    group: "Kubernetes · Workloads",
    chapter: "Kubernetes · Workloads · Coming soon",
    subtitle: "Requests versus real usage, by namespace.",
    question: "Which workloads request far more memory than they use?",
    answer:
      "Six workloads in the platform namespace request 24 GiB of memory but use 7 GiB at the 95th percentile. The gap reserves capacity that is never used. Lowering requests to the measured 95th percentile, with a 20% buffer, would free about 9 GiB across the cluster.",
    time: 9,
    evidence:
      "Kubernetes metrics · platform namespace · requests 24 GiB · p95 usage 7 GiB · [6]",
    transcript: [
      {
        id: "k8s-1",
        time: 0,
        text: "Kubernetes · platform namespace · 6 workloads · memory requests 24 GiB.",
      },
      {
        id: "k8s-2",
        time: 9,
        text: "95th-percentile memory usage 7 GiB · requests exceed usage by 17 GiB.",
      },
      {
        id: "k8s-3",
        time: 18,
        text: "A 20% buffer above p95 would free about 9 GiB across the cluster.",
      },
    ],
  },
];

export const featuredSampleStories = [0, 1, 2, 3, 4, 5].map((index) => ({
  ...sampleStories[index],
  index,
}));
