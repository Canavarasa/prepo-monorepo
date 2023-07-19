import { Button, Checkbox, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { useMemo, useState } from 'react'
import rules from '../../lib/rules'
import { useRootStore } from '../../context/RootStoreProvider'
import { TestIds } from '../../components/TestId'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(12)};
  margin-bottom: 0;
  padding: ${spacingIncrement(8)};
  padding-right: 14px;
  width: 100%;
`

const Text = styled.span`
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.regular};
`

const StyledCheckbox = styled(Checkbox)`
  &.ant-checkbox-wrapper {
    align-items: flex-start;

    .ant-checkbox {
      padding: ${spacingIncrement(4)};
    }
  }
`

const RulesPage: React.FC = () => {
  const { termsStore } = useRootStore()
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  const allChecked = useMemo(() => {
    const uncheckedIndex = rules.findIndex((_, index) => !checked[index])
    return uncheckedIndex < 0
  }, [checked])

  return (
    <>
      <Wrapper data-testid={TestIds.RulesScroll}>
        {rules.map((rule, index) => (
          <StyledCheckbox
            key={rule.id}
            checked={checked[index]}
            onChange={(e): void => {
              setChecked({ ...checked, [index]: e.target.checked })
            }}
          >
            <Text>{rule.content}</Text>
          </StyledCheckbox>
        ))}
      </Wrapper>
      <Button block disabled={!allChecked} onClick={termsStore.agreeToRules}>
        I Agree
      </Button>
    </>
  )
}

export default RulesPage
