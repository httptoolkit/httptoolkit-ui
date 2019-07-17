import * as _ from 'lodash';
import * as React from 'react';
import * as polished from 'polished';
import { observer, inject } from 'mobx-react';

import { styled } from '../../styles';
import { WithInjected } from '../../types';

import { ActivatedStore } from '../../model/interception-store';
import { summarizeAction, summarizeMatcher, DefaultRules } from '../../model/rules';

import { LittleCard } from '../common/card';
import { FontAwesomeIcon } from '../../icons';
import { action } from 'mobx';

interface MockPageProps {
    className?: string,
    interceptionStore: ActivatedStore,
}

const MockPageContainer = styled.section`
    height: 100%;
    overflow-y: auto;
    position: relative;

    max-width: 1200px;
    margin: 0 auto;
    padding: 40px;
`;

const MockPageHeader = styled.header`
    width: 100%;
    margin-bottom: 40px;

    display: flex;
    flex-direction: row;
    align-items: center;
`;

const MockHeading = styled.h1`
    font-size: ${p => p.theme.loudHeadingSize};
    font-weight: bold;
`;

const MockRuleList = styled.ol`
`;

const MockRuleItem = styled(LittleCard)`
    width: 100%;
    margin: 20px 0;

    display: flex;
    flex-direction: row;
    justify-content: space-between;

    font-size: ${p => p.theme.headingSize};

    svg {
        margin: 0 5px;
    }
`;

const AddNewRuleItem = styled(MockRuleItem)`
    justify-content: center;
    background-color: ${p =>
        polished.rgba(p.theme.mainBackground, 0.4)
    };
    box-shadow: 0 0 4px 0 rgba(0,0,0,0.2);
`;

const RuleMatcher = styled.p`
    flex-grow: 1;
    flex-basis: 0;
    text-align: left;
`

const RuleAction = styled.p`
    flex-grow: 1;
    flex-basis: 0;
    text-align: right;
`

@inject('interceptionStore')
@observer
class MockPage extends React.Component<MockPageProps> {

    render(): JSX.Element {
        const { interceptionRules } = this.props.interceptionStore;

        return <MockPageContainer>
            <MockPageHeader>
                <MockHeading>Mock & Rewrite HTTP</MockHeading>
            </MockPageHeader>

            <MockRuleList>
                <AddNewRuleItem onClick={action(() => {
                    interceptionRules.unshift(DefaultRules.amIUsingHTKRule);
                })}>
                    <FontAwesomeIcon icon={['fas', 'plus']} />
                    Add a new rule to rewrite requests or responses
                </AddNewRuleItem>

                { interceptionRules.map((rule, i) =>
                    <MockRuleItem key={i} onClick={() => {}}>
                        <RuleMatcher>
                            { summarizeMatcher(rule) }
                        </RuleMatcher>

                        <FontAwesomeIcon icon={['fas', 'arrow-left']} rotation={180} />

                        <RuleAction>
                            { summarizeAction(rule) }
                        </RuleAction>
                    </MockRuleItem>
                ) }
            </MockRuleList>
        </MockPageContainer>
    }
}

// Annoying cast required to handle the store prop nicely in our types
const InjectedMockPage = MockPage as unknown as WithInjected<
    typeof MockPage,
    'interceptionStore'
>;
export { InjectedMockPage as MockPage };