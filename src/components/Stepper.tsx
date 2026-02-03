
import {
  Stepper as MuiStepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Box,
  styled,
  StepIconProps,
} from "@mui/material";
import Check from "@mui/icons-material/Check";

const QontoConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
    left: 'calc(-50% + 20px)',
    right: 'calc(50% + 20px)',
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.primary.main,
      backgroundImage: `linear-gradient(45deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: `linear-gradient(45deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderTopWidth: 3,
    borderRadius: 1,
  },
}));



// Advanced Premium Stepper Icon
const ColorlibStepIconRoot = styled('div')<{
  ownerState: { completed?: boolean; active?: boolean };
}>(({ theme, ownerState }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : '#ccc',
  zIndex: 1,
  color: '#fff',
  width: 50,
  height: 50,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  transition: 'all 0.3s ease',
  ...(ownerState.active && {
    backgroundImage:
      `linear-gradient(136deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    boxShadow: '0 4px 10px 0 rgba(0,0,0,.25)',
    transform: 'scale(1.1)',
  }),
  ...(ownerState.completed && {
    backgroundImage:
      `linear-gradient(136deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  }),
}));

function ColorlibStepIcon(props: StepIconProps) {
  const { active, completed, icon } = props;

  return (
    <ColorlibStepIconRoot ownerState={{ completed: !!completed, active: !!active }}>
      {/* Render icon based on number if string, or icon if passed */}
      {completed ? <Check /> : icon}
    </ColorlibStepIconRoot>
  );
}

type Props = {
  step: number;
  steps: string[];
  onStepClick?: (stepIndex: number) => void;
};

export default function Stepper({ step, steps, onStepClick }: Props) {
  // Determine if a step is clickable
  // Steps 0, 1, 2 (Upload, Preview, Sync) are never clickable
  // Steps 3, 4 (Result, Job Summary) are clickable only when current step >= 3
  const isStepClickable = (stepIndex: number) => {
    if (stepIndex < 3) return false; // Steps 0, 1, 2 are never clickable
    if (step < 3) return false; // Can't navigate to later steps if not yet at step 3
    return true; // Steps 3, 4 are clickable when user is in step 3+
  };

  // Determine if a step is locked (cannot be revisited)
  const isStepLocked = (stepIndex: number) => {
    return stepIndex < 3 && step >= 3; // First 3 steps are locked when user is in step 3+
  };

  const handleStepClick = (stepIndex: number) => {
    if (isStepClickable(stepIndex) && onStepClick) {
      onStepClick(stepIndex);
    }
  };

  return (
    <Box sx={{ width: '100%', mb: 6, mt: 2 }}>
      <MuiStepper alternativeLabel activeStep={step} connector={<QontoConnector />}>
        {steps.map((label, index) => {
          const clickable = isStepClickable(index);
          const locked = isStepLocked(index);
          return (
            <Step key={label}>
              <StepLabel
                StepIconComponent={ColorlibStepIcon}
                onClick={() => handleStepClick(index)}
                sx={{
                  cursor: clickable ? 'pointer' : locked ? 'not-allowed' : 'default',
                  opacity: locked ? 0.4 : 1,
                  transition: 'all 0.3s ease',
                  '&:hover': clickable ? {
                    '& .MuiStepLabel-label': {
                      color: 'primary.main',
                      transform: 'scale(1.05)',
                    }
                  } : {},
                  '& .MuiStepLabel-label': {
                    transition: 'all 0.2s ease',
                    fontWeight: clickable ? 600 : locked ? 400 : 500,
                  }
                }}
              >
                {label}
              </StepLabel>
            </Step>
          );
        })}
      </MuiStepper>
    </Box>
  );
}
